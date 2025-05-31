import { Client } from "@notionhq/client";

interface Budget {
	min?: number;
	max?: number;
}

interface ProjectData {
	projectId?: string;
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
	 * プロジェクトデータをNotionデータベースに書き込む
	 * @param projectData - プロジェクトデータ
	 */
	async addProject(projectData: ProjectData): Promise<any> {
		try {
			const properties = this.buildNotionProperties(projectData);

			const response = await this.notion.pages.create({
				parent: { database_id: this.databaseId },
				properties: properties,
			});

			console.log("✅ プロジェクトが正常に追加されました:", response.id);
			return response;
		} catch (error) {
			console.error(
				"❌ プロジェクトの追加に失敗しました:",
				(error as Error).message,
			);
			throw error;
		}
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

		// 詳細説明
		if (data.description) {
			properties["詳細説明"] = {
				rich_text: [
					{
						text: {
							content: data.description,
						},
					},
				],
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

	/**
	 * 複数のプロジェクトを一括で追加
	 * @param projectsArray - プロジェクトデータの配列
	 */
	async addMultipleProjects(
		projectsArray: ProjectData[],
	): Promise<AddProjectResult[]> {
		const results: AddProjectResult[] = [];

		for (const project of projectsArray) {
			try {
				const result = await this.addProject(project);
				results.push({ success: true, data: result });

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
			`\n📊 処理結果: ${results.filter((r) => r.success).length}件成功 / ${results.filter((r) => !r.success).length}件失敗`,
		);
		return results;
	}
}

// 使用例
async function main() {
	// 環境変数またはここに直接設定
	const NOTION_TOKEN =
		process.env.NOTION_TOKEN || "your_notion_integration_token";
	const DATABASE_ID =
		process.env.DATABASE_ID || "204ae001-11eb-80c8-a90d-f0fb24c0082e";

	const projectManager = new NotionProjectManager(NOTION_TOKEN, DATABASE_ID);

	// サンプルデータ
	const sampleProject: ProjectData = {
		projectId: "4234644",
		platform: "coconala",
		hidden: false,
		wageType: "fixed",
		url: "https://coconala.com/requests/4234644",
		title: "競馬のレース映像2つを同時視聴したいです。",
		category: "プログラミング・ソフトウェア",
		budget: {
			min: 5000,
			max: 10000,
		},
		deliveryDate: "2025-06-03T15:00:00.000Z",
		recruitingLimit: "2025-05-29T15:00:00.000Z",
		description:
			"【 募集詳細 】\nJRAが公式で出しています映像\n(レース映像とパトロールビデオ)の\n同時視聴をしたいと思っております。\n2分割で観る形で、着順やタイム等は端などに記載。\nまた、動画を観るにあたり2つの動画の始まりには\n多少の時間ズレがございます。その為、音声等で\nそのズレがない形が好ましいです。巻き戻しなども連動出来る仕様が良いと思っております。",
		publicationDate: "2025-05-26T15:00:00.000Z",
		isRecruiting: true,
	};

	try {
		// 単一プロジェクトの追加
		await projectManager.addProject(sampleProject);

		// 複数プロジェクトの追加例
		// const projects = [sampleProject, anotherProject, ...];
		// await projectManager.addMultipleProjects(projects);
	} catch (error) {
		console.error("エラーが発生しました:", error);
	}
}

main();

export default NotionProjectManager;
