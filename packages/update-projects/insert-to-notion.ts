import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NotionProjectManager, type ProjectData } from "./notion-project-manager";

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