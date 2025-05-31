import { Client } from "@notionhq/client";
import coconalaProjects from "./coconala-projects.json";
import crowdworksProjects from "./crowdworks-projects.json";

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

interface AddProjectResult {
	success: boolean;
	data?: any;
	error?: string;
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
	 * - 単一の<br>は改行(\n)に変換
	 * - 連続する<br>は新しいブロックとして分割
	 * - 2000文字を超える場合は新しいブロックに分割
	 */
	private formatDescriptionBlocks(description: string): Array<{ object: 'block', type: 'paragraph', paragraph: { rich_text: Array<{ type: 'text', text: { content: string } }> } }> {
		const blocks: Array<{ object: 'block', type: 'paragraph', paragraph: { rich_text: Array<{ type: 'text', text: { content: string } }> } }> = [];
		
		// 連続する<br>で分割（2つ以上の<br>を区切りとする）
		const paragraphs = description.split(/(?:<br\s*\/?>\s*){2,}/g);
		
		for (const paragraph of paragraphs) {
			if (!paragraph.trim()) continue;
			
			// 単一の<br>を改行に変換
			let formattedText = paragraph.replace(/<br\s*\/?>/g, '\n').trim();
			
			// 2000文字を超える場合は分割
			if (formattedText.length <= 2000) {
				blocks.push({
					object: 'block' as const,
					type: 'paragraph' as const,
					paragraph: {
						rich_text: [{
							type: 'text' as const,
							text: {
								content: formattedText
							}
						}]
					}
				});
			} else {
				// 2000文字ごとに分割
				let currentIndex = 0;
				while (currentIndex < formattedText.length) {
					const chunk = formattedText.slice(currentIndex, currentIndex + 2000);
					blocks.push({
						object: 'block' as const,
						type: 'paragraph' as const,
						paragraph: {
							rich_text: [{
								type: 'text' as const,
								text: {
									content: chunk
								}
							}]
						}
					});
					currentIndex += 2000;
				}
			}
		}
		
		return blocks;
	}

	/**
	 * プロジェクトIDとプラットフォームで既存のページを検索
	 * @param projectId - プロジェクトID
	 * @param platform - プラットフォーム名
	 */
	async findExistingPage(projectId: string, platform: string): Promise<any | null> {
		try {
			const response = await this.notion.databases.query({
				database_id: this.databaseId,
				filter: {
					and: [
						{
							property: "プロジェクトID",
							number: {
								equals: Number.parseInt(projectId),
							},
						},
						{
							property: "プラットフォーム",
							select: {
								equals: platform,
							},
						},
					],
				},
			});

			return response.results.length > 0 ? response.results[0] : null;
		} catch (error) {
			console.error("検索エラー:", (error as Error).message);
			return null;
		}
	}

	/**
	 * プロジェクトデータをNotionデータベースにupsert（存在すれば更新、なければ作成）
	 * @param projectData - プロジェクトデータ
	 */
	async upsertProject(projectData: ProjectData): Promise<any> {
		try {
			if (!projectData.projectId || !projectData.platform) {
				throw new Error("プロジェクトIDとプラットフォームは必須です");
			}

			const properties = this.buildNotionProperties(projectData);
			const existingPage = await this.findExistingPage(projectData.projectId, projectData.platform);

			if (existingPage) {
				// 既存のページを更新
				const response = await this.notion.pages.update({
					page_id: existingPage.id,
					properties: properties,
				});
				
				// 詳細説明を本文として追加/更新
				// まず既存のブロックを取得
				if (projectData.description) {
					try {
						const blocks = await this.notion.blocks.children.list({
							block_id: existingPage.id,
						});
						
						// 既存のブロックをすべて削除
						for (const block of blocks.results) {
							if ('id' in block) {
								await this.notion.blocks.delete({ block_id: block.id });
							}
						}
						
						// 新しいブロックを追加
						const descriptionBlocks = this.formatDescriptionBlocks(projectData.description);
						await this.notion.blocks.children.append({
							block_id: existingPage.id,
							children: descriptionBlocks
						});
					} catch (error) {
						console.warn("本文の更新に失敗しました:", (error as Error).message);
					}
				}
				
				console.log(`✅ プロジェクトが更新されました: ${projectData.title || projectData.projectId}`);
				return response;
			} else {
				// 新規ページを作成
				const createData: any = {
					parent: { database_id: this.databaseId },
					properties: properties,
				};
				
				// 詳細説明を本文として追加
				if (projectData.description) {
					createData.children = this.formatDescriptionBlocks(projectData.description);
				}
				
				const response = await this.notion.pages.create(createData);
				console.log(`✅ プロジェクトが追加されました: ${projectData.title || projectData.projectId}`);
				return response;
			}
		} catch (error) {
			console.error(
				"❌ プロジェクトのupsertに失敗しました:",
				(error as Error).message,
			);
			throw error;
		}
	}

	/**
	 * プロジェクトデータをNotionデータベースに書き込む（後方互換性のため残す）
	 * @param projectData - プロジェクトデータ
	 */
	async addProject(projectData: ProjectData): Promise<any> {
		return this.upsertProject(projectData);
	}

	/**
	 * JSONデータをNotionプロパティ形式に変換
	 * @param data - プロジェクトデータ
	 * @returns Notionプロパティオブジェクト
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
				number: Number.parseInt(data.projectId),
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

		// 詳細説明は本文に含めるため、プロパティには含めない

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

	/**
	 * 複数のプロジェクトを一括でupsert
	 * @param projectsArray - プロジェクトデータの配列
	 */
	async upsertMultipleProjects(
		projectsArray: ProjectData[],
	): Promise<AddProjectResult[]> {
		const results: AddProjectResult[] = [];
		let created = 0;
		let updated = 0;

		for (const project of projectsArray) {
			try {
				if (!project.projectId || !project.platform) {
					console.warn("プロジェクトIDまたはプラットフォームが不足:", project.title || "タイトルなし");
					continue;
				}
				
				const existingPage = await this.findExistingPage(project.projectId, project.platform);
				const result = await this.upsertProject(project);
				results.push({ success: true, data: result });
				
				if (existingPage) {
					updated++;
				} else {
					created++;
				}

				// API制限を考慮して少し待機
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				results.push({
					success: false,
					error: (error as Error).message,
					data: project,
				});
			}
		}

		console.log(
			`\n📊 処理結果: ${created}件作成 / ${updated}件更新 / ${results.filter((r) => !r.success).length}件失敗`,
		);
		return results;
	}

	/**
	 * 複数のプロジェクトを一括で追加（後方互換性のため残す）
	 * @param projectsArray - プロジェクトデータの配列
	 */
	async addMultipleProjects(
		projectsArray: ProjectData[],
	): Promise<AddProjectResult[]> {
		return this.upsertMultipleProjects(projectsArray);
	}
}

// JSONファイルからプロジェクトをインポートしてDBを更新
async function main() {
	// 環境変数またはここに直接設定
	const NOTION_TOKEN =
		process.env.NOTION_TOKEN || "your_notion_integration_token";
	const DATABASE_ID =
		process.env.DATABASE_ID || "204ae001-11eb-80c8-a90d-f0fb24c0082e";

	const projectManager = new NotionProjectManager(NOTION_TOKEN, DATABASE_ID);

	try {
		console.log("🔄 プロジェクトのインポートを開始します...");
		
		// Coconalaプロジェクトのインポート
		if (coconalaProjects.length > 0) {
			console.log(`\n📂 Coconalaプロジェクト: ${coconalaProjects.length}件`);
			await projectManager.upsertMultipleProjects(coconalaProjects as ProjectData[]);
		}

		// CrowdWorksプロジェクトのインポート
		if (crowdworksProjects.length > 0) {
			console.log(`\n📂 CrowdWorksプロジェクト: ${crowdworksProjects.length}件`);
			await projectManager.upsertMultipleProjects(crowdworksProjects as ProjectData[]);
		}

		console.log("\n✅ インポートが完了しました");
	} catch (error) {
		console.error("\n❌ エラーが発生しました:", error);
	}
}

main();

export default NotionProjectManager;
