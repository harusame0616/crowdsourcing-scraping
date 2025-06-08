import { Client } from "@notionhq/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Budget {
	min?: number;
	max?: number;
}

interface ProjectData {
	projectId?: string | number;
	platform?: string;
	hidden?: boolean;
	wageType?: string;
	url?: string;
	title?: string;
	category?: string;
	budget?: Budget;
	deliveryDate?: string;
	recruitingLimit?: string;
	description?: string;
	publicationDate?: string;
	isRecruiting?: boolean;
}

interface NotionProperty {
	[key: string]: any;
}

class NotionProjectManager {
	private notion: Client;
	private databaseId: string;

	constructor(notionToken: string, databaseId: string) {
		this.notion = new Client({ auth: notionToken });
		this.databaseId = databaseId;
	}

	/**
	 * descriptionを適切なブロックに分割
	 */
	private formatDescriptionBlocks(description: string): Array<{
		object: "block";
		type: "paragraph";
		paragraph: {
			rich_text: Array<{ type: "text"; text: { content: string } }>;
		};
	}> {
		const blocks: Array<{
			object: "block";
			type: "paragraph";
			paragraph: {
				rich_text: Array<{ type: "text"; text: { content: string } }>;
			};
		}> = [];

		// 連続する<br>で分割（2つ以上の<br>を区切りとする）
		const paragraphs = description.split(/(?:<br\s*\/?>\s*){2,}/g);

		for (const paragraph of paragraphs) {
			if (!paragraph.trim()) continue;

			// 単一の<br>を改行に変換
			const formattedText = paragraph.replace(/<br\s*\/?>/g, "\n").trim();

			// 2000文字を超える場合は分割
			if (formattedText.length <= 2000) {
				blocks.push({
					object: "block" as const,
					type: "paragraph" as const,
					paragraph: {
						rich_text: [
							{
								type: "text" as const,
								text: {
									content: formattedText,
								},
							},
						],
					},
				});
			} else {
				// 2000文字ごとに分割
				let currentIndex = 0;
				while (currentIndex < formattedText.length) {
					const chunk = formattedText.slice(currentIndex, currentIndex + 2000);
					blocks.push({
						object: "block" as const,
						type: "paragraph" as const,
						paragraph: {
							rich_text: [
								{
									type: "text" as const,
									text: {
										content: chunk,
									},
								},
							],
						},
					});
					currentIndex += 2000;
				}
			}
		}

		return blocks;
	}

	/**
	 * 複数のプロジェクトIDに対して既存のプロジェクトを一括検索
	 */
	async findByProjectIds(
		projectIds: Array<{ projectId: number; platform: string }>,
	): Promise<ProjectData[]> {
		if (projectIds.length === 0) {
			return [];
		}

		try {
			// OR条件を構築して一括でクエリを実行
			const orConditions = projectIds.map(({ projectId, platform }) => ({
				and: [
					{
						property: "プロジェクトID",
						number: {
							equals: projectId,
						},
					},
					{
						property: "プラットフォーム",
						select: {
							equals: platform,
						},
					},
				],
			}));

			// Notion APIでページング処理
			let hasMore = true;
			let startCursor: string | undefined = undefined;
			const existingProjects: ProjectData[] = [];

			while (hasMore) {
				const response = await this.notion.databases.query({
					database_id: this.databaseId,
					filter: {
						or: orConditions,
					},
					start_cursor: startCursor,
					page_size: 100,
				});

				// Notionのページから ProjectData に変換
				for (const page of response.results) {
					if (
						"properties" in page &&
						page.properties?.["プロジェクトID"]?.number &&
						page.properties?.["プラットフォーム"]?.select?.name
					) {
						const project: ProjectData = {
							projectId: page.properties["プロジェクトID"].number,
							platform: page.properties["プラットフォーム"].select.name,
						};

						// その他のプロパティも取得
						if (page.properties["名前"]?.title?.[0]?.text?.content) {
							project.title = page.properties["名前"].title[0].text.content;
						}
						if (page.properties["非表示"]?.checkbox !== undefined) {
							project.hidden = page.properties["非表示"].checkbox;
						}
						if (page.properties["報酬タイプ"]?.select?.name) {
							project.wageType = page.properties["報酬タイプ"].select.name;
						}
						if (page.properties["URL"]?.url) {
							project.url = page.properties["URL"].url;
						}
						if (page.properties["カテゴリ"]?.select?.name) {
							project.category = page.properties["カテゴリ"].select.name;
						}
						if (
							page.properties["予算最小"]?.number ||
							page.properties["予算最大"]?.number
						) {
							project.budget = {
								min: page.properties["予算最小"]?.number,
								max: page.properties["予算最大"]?.number,
							};
						}
						if (page.properties["納期"]?.date?.start) {
							project.deliveryDate = page.properties["納期"].date.start;
						}
						if (page.properties["募集期限"]?.date?.start) {
							project.recruitingLimit = page.properties["募集期限"].date.start;
						}
						if (page.properties["公開日"]?.date?.start) {
							project.publicationDate = page.properties["公開日"].date.start;
						}
						if (page.properties["募集中"]?.checkbox !== undefined) {
							project.isRecruiting = page.properties["募集中"].checkbox;
						}

						existingProjects.push(project);
					}
				}

				hasMore = response.has_more;
				startCursor = response.next_cursor || undefined;

				// API制限を考慮して少し待機
				if (hasMore) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}

			return existingProjects;
		} catch (error) {
			console.error(
				"一括検索でエラーが発生しました:",
				(error as Error).message,
			);
			return [];
		}
	}

	/**
	 * 複数のプロジェクトを一括で追加
	 */
	async addProjects(
		projects: ProjectData[],
	): Promise<{ success: number; failed: number; errors: Array<{ project: ProjectData; error: string }> }> {
		let successCount = 0;
		let failedCount = 0;
		const errors: Array<{ project: ProjectData; error: string }> = [];

		console.log(`📝 ${projects.length}件のプロジェクトを追加します...`);

		// Notion APIは一括作成をサポートしていないため、並列処理で高速化
		const BATCH_SIZE = 10; // 同時実行数
		for (let i = 0; i < projects.length; i += BATCH_SIZE) {
			const batch = projects.slice(i, i + BATCH_SIZE);
			const results = await Promise.allSettled(
				batch.map(async (project) => {
					if (!project.projectId || !project.platform) {
						throw new Error("プロジェクトIDとプラットフォームは必須です");
					}

					const properties = this.buildNotionProperties(project);
					const createData: any = {
						parent: { database_id: this.databaseId },
						properties: properties,
					};

					// 詳細説明を本文として追加
					if (project.description) {
						createData.children = this.formatDescriptionBlocks(
							project.description,
						);
					}

					const response = await this.notion.pages.create(createData);
					console.log(
						`✅ プロジェクトが追加されました: ${project.title || project.projectId}`,
					);
					return { project, response };
				})
			);

			// 結果を集計
			for (let j = 0; j < results.length; j++) {
				const result = results[j];
				const project = batch[j];
				
				if (result.status === "fulfilled") {
					successCount++;
				} else {
					failedCount++;
					const errorMessage = result.reason?.message || "Unknown error";
					errors.push({ project, error: errorMessage });
					console.error(
						`❌ プロジェクト ${project.title || project.projectId} の追加に失敗: ${errorMessage}`,
					);
				}
			}

			// バッチ間の待機
			if (i + BATCH_SIZE < projects.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(
			`\n📊 処理結果: ${successCount}件成功 / ${failedCount}件失敗`,
		);

		return {
			success: successCount,
			failed: failedCount,
			errors,
		};
	}

	/**
	 * JSONデータをNotionプロパティ形式に変換
	 */
	buildNotionProperties(data: ProjectData): NotionProperty {
		const properties: NotionProperty = {};

		// タイトル（名前）
		if (data.title) {
			properties["名前"] = {
				title: [
					{
						text: {
							content: data.title,
						},
					},
				],
			};
		}

		// プロジェクトID
		if (data.projectId) {
			properties["プロジェクトID"] = {
				number: Number.parseInt(String(data.projectId)),
			};
		}

		// プラットフォーム
		if (data.platform) {
			properties["プラットフォーム"] = {
				select: {
					name: data.platform,
				},
			};
		}

		// 非表示
		if (typeof data.hidden === "boolean") {
			properties["非表示"] = {
				checkbox: data.hidden,
			};
		}

		// 報酬タイプ
		if (data.wageType) {
			properties["報酬タイプ"] = {
				select: {
					name: data.wageType,
				},
			};
		}

		// URL
		if (data.url) {
			properties["URL"] = {
				url: data.url,
			};
		}

		// カテゴリ
		if (data.category) {
			properties["カテゴリ"] = {
				select: {
					name: data.category,
				},
			};
		}

		// 予算
		if (data.budget) {
			if (data.budget.min) {
				properties["予算最小"] = {
					number: data.budget.min,
				};
			}
			if (data.budget.max) {
				properties["予算最大"] = {
					number: data.budget.max,
				};
			}
		}

		// 納期
		if (data.deliveryDate) {
			properties["納期"] = {
				date: {
					start: data.deliveryDate,
				},
			};
		}

		// 募集期限
		if (data.recruitingLimit) {
			properties["募集期限"] = {
				date: {
					start: data.recruitingLimit,
				},
			};
		}

		// 公開日
		if (data.publicationDate) {
			properties["公開日"] = {
				date: {
					start: data.publicationDate,
				},
			};
		}

		// 募集中
		if (typeof data.isRecruiting === "boolean") {
			properties["募集中"] = {
				checkbox: data.isRecruiting,
			};
		}

		return properties;
	}
}

// JSONファイルからプロジェクトをインポートしてDBを更新
async function main() {
	// コマンドライン引数からファイルパスを取得
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("❌ エラー: ファイルパスを指定してください");
		console.error("使用方法: tsx insert-to-notion.ts <ファイルパス>");
		process.exit(1);
	}

	const filePath = resolve(args[0]);

	// 環境変数またはここに直接設定
	const NOTION_TOKEN =
		process.env.NOTION_TOKEN || "your_notion_integration_token";
	const DATABASE_ID =
		process.env.DATABASE_ID || "204ae001-11eb-80c8-a90d-f0fb24c0082e";

	const projectManager = new NotionProjectManager(NOTION_TOKEN, DATABASE_ID);

	try {
		// 1. ファイル（プロジェクト）を読み込む
		console.log(`📄 ファイルを読み込んでいます: ${filePath}`);
		const fileContent = readFileSync(filePath, "utf-8");
		const projects = JSON.parse(fileContent) as ProjectData[];

		if (!Array.isArray(projects)) {
			throw new Error("ファイルの内容が配列ではありません");
		}

		console.log(`📝 ${projects.length}件のプロジェクトが見つかりました`);

		// 2. ファイルの一覧に含まれているプロジェクトIDをリスト化する
		const projectIds = projects
			.filter((project) => project.projectId && project.platform)
			.map((project) => ({
				projectId: Number.parseInt(String(project.projectId)),
				platform: project.platform as string,
			}));

		console.log(`🔍 有効なプロジェクトID: ${projectIds.length}件`);

		if (projectIds.length === 0) {
			console.log("処理対象のプロジェクトがありません");
			return;
		}

		// 3. プロジェクトIDのリストがすでにNotion上に登録されているか確認
		console.log("🔄 Notion DBから既存プロジェクトを確認中...");
		const existingProjects = await projectManager.findByProjectIds(projectIds);

		const existingProjectIds = new Set<string>(
			existingProjects.map(
				(project) => `${project.projectId}-${project.platform}`,
			),
		);

		console.log(`✅ 既存プロジェクト: ${existingProjectIds.size}件`);

		// 4. すでにNotion上に存在するプロジェクト以外をnotionに追加する
		const newProjects = projects.filter((project) => {
			if (!project.projectId || !project.platform) {
				return false;
			}
			return !existingProjectIds.has(
				`${Number.parseInt(String(project.projectId))}-${project.platform}`,
			);
		});

		console.log(`🆕 追加対象プロジェクト: ${newProjects.length}件`);

		if (newProjects.length === 0) {
			console.log("追加するプロジェクトがありません（全て既に登録済み）");
			return;
		}

		// 新しいプロジェクトのみをNotionに追加
		const result = await projectManager.addProjects(newProjects);

		console.log("✅ インポートが完了しました");
		
		// エラーがあった場合は詳細を表示
		if (result.failed > 0) {
			console.log("\n❌ 失敗したプロジェクト:");
			for (const { project, error } of result.errors) {
				console.log(`  - ${project.title || project.projectId}: ${error}`);
			}
		}
	} catch (error) {
		if (error instanceof Error) {
			if ("code" in error && error.code === "ENOENT") {
				console.error(`\n❌ エラー: ファイルが見つかりません: ${filePath}`);
			} else if (error instanceof SyntaxError) {
				console.error(
					`\n❌ エラー: JSONファイルの形式が正しくありません: ${error.message}`,
				);
			} else {
				console.error(`\n❌ エラーが発生しました: ${error.message}`);
			}
		} else {
			console.error("\n❌ 予期しないエラーが発生しました:", error);
		}
		process.exit(1);
	}
}

main();

export default NotionProjectManager;