import type { Page } from "playwright";

export class LancersListPom {
	constructor(private page: Page) {}

	async getProjects(): Promise<string[]> {
		// プロジェクトリンクを全て取得
		const projectLinks = await this.page
			.locator('a[href^="/work/detail/"]')
			.all();

		// 各リンクからプロジェクトIDを抽出
		const projectIds: string[] = [];
		for (const link of projectLinks) {
			const href = await link.getAttribute("href");
			if (href) {
				// /work/detail/5322167 から 5322167 を抽出
				const match = href.match(/\/work\/detail\/(\d+)/);
				if (match?.[1]) {
					projectIds.push(match[1]);
				}
			}
		}

		// 重複を除去して返す
		return [...new Set(projectIds)];
	}
}
