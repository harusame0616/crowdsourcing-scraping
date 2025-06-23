import type { Page } from "playwright";

export class LancersDetailPOM {
	constructor(private page: Page) {}

	async isNotFound(): Promise<boolean> {
		try {
			// 404ページのチェック
			const is404 = await this.page.locator('h1:has-text("404")').isVisible({ timeout: 3000 });
			if (is404) return true;
			
			// ページが見つからない時のメッセージ
			const notFoundMessage = await this.page.locator(':has-text("ページが見つかりません")').isVisible({ timeout: 3000 });
			return notFoundMessage;
		} catch {
			return false;
		}
	}

	async getTitle(): Promise<string> {
		try {
			// より具体的なセレクタを使用（メインのタイトルのみを取得）
			const titleElement = await this.page.locator('h1.c-heading--lv1').first();
			
			if (await titleElement.isVisible({ timeout: 5000 })) {
				const title = await titleElement.textContent({ timeout: 3000 });
				if (title?.trim()) {
					return title.trim();
				}
			}
		} catch {}
		
		// フォールバック: ページタイトルから取得
		try {
			const pageTitle = await this.page.title();
			// 不要な文字列を除去してタイトルを整形
			const cleanTitle = pageTitle
				.replace(/\s*\|　*ランサーズ.*/g, '')
				.replace(/\s*\|　*ランサーズ/g, '')
				.trim();
			
			if (cleanTitle) {
				return cleanTitle;
			}
		} catch {}
		
		throw new Error("タイトルが見つかりません");
	}

	async isRecruiting(): Promise<boolean> {
		// 募集終了のバッジがあるかチェック
		const isClosed = await this.page
			.locator('.c-badge--closed')
			.isVisible()
			.catch(() => false);
		return !isClosed;
	}

	async isFixedWageType(): Promise<boolean> {
		try {
			// 複数のセレクタを試して報酬形式を判定
			const selectors = [
				'.c-definitionList__term:has-text("報酬")',
				'.c-definitionList__term:has-text("予算")',
				'.c-definitionList__term:has-text("価格")',
			];

			for (const selector of selectors) {
				try {
					const term = await this.page.locator(selector).first();
					if (await term.isVisible({ timeout: 5000 })) {
						const description = await term
							.locator('~ .c-definitionList__description')
							.first()
							.textContent({ timeout: 5000 });
						
						if (description) {
							// 時間報酬や時給に関するキーワードがあれば時間報酬制
							if (description.includes("時間") || description.includes("時給") || 
								description.includes("/時") || description.includes("時間単価")) {
								return false;
							}
							// 固定報酬に関するキーワードがあれば固定報酬制
							if (description.includes("固定") || description.includes("一括")) {
								return true;
							}
						}
					}
				} catch {
					continue;
				}
			}

			// キーワードから判定できない場合、ページ全体のテキストから判定
			const pageText = await this.page.textContent('body');
			if (pageText) {
				if (pageText.includes("時間報酬") || pageText.includes("時給")) {
					return false;
				}
			}

			// デフォルトは固定報酬制として扱う
			return true;
		} catch {
			// エラーが発生した場合はデフォルトで固定報酬制として扱う
			return true;
		}
	}

	async getCategory(): Promise<string> {
		// カテゴリを取得
		const category = await this.page
			.locator('.c-breadcrumb__item')
			.nth(2) // 通常3番目の要素がカテゴリ
			.textContent()
			.catch(() => null);
		
		if (!category) {
			// 別のセレクタを試す
			const altCategory = await this.page
				.locator('.project-category')
				.textContent()
				.catch(() => null);
			
			if (!altCategory) {
				return "その他";
			}
			return altCategory.trim();
		}
		return category.trim();
	}

	async getBudgetText(): Promise<string> {
		try {
			// まず予算の項目を探す
			const budgetTerm = await this.page
				.locator('.c-definitionList__term')
				.filter({ hasText: /^予算$/ })
				.first();
			
			if (await budgetTerm.isVisible({ timeout: 3000 })) {
				// 隣接する説明要素を取得
				const budgetText = await budgetTerm
					.locator('~ .c-definitionList__description')
					.first()
					.textContent({ timeout: 5000 });
				
				return budgetText?.trim() || "";
			}
		} catch {}
		
		return "";
	}

	async getRecruitingLimitText(): Promise<string> {
		try {
			// 納期または応募期限を探す
			const limitTerm = await this.page
				.locator('.c-definitionList__term')
				.filter({ hasText: /^(納期|応募期限)$/ })
				.first();
			
			if (await limitTerm.isVisible({ timeout: 3000 })) {
				const limitText = await limitTerm
					.locator('~ .c-definitionList__description')
					.first()
					.textContent({ timeout: 5000 });
				
				return limitText?.trim() || "";
			}
		} catch {}
		
		return "";
	}

	async getPublicationDateText(): Promise<string> {
		try {
			// 登録日時を取得
			const dateTerm = await this.page
				.locator('.c-definitionList__term')
				.filter({ hasText: /^登録日時$/ })
				.first();
			
			if (await dateTerm.isVisible({ timeout: 3000 })) {
				const dateText = await dateTerm
					.locator('~ .c-definitionList__description')
					.first()
					.textContent({ timeout: 5000 });
				
				if (dateText?.trim()) {
					return dateText.trim();
				}
			}
		} catch {}
		
		// デフォルトの日付を返す
		const now = new Date();
		return `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;
	}

	async getWorkingTimeText(): Promise<string> {
		try {
			// 稼働時間を取得（時間報酬制の場合）
			const workingTimeTerm = await this.page
				.locator('.c-definitionList__term')
				.filter({ hasText: /^稼働時間$/ })
				.first();
			
			if (await workingTimeTerm.isVisible({ timeout: 3000 })) {
				const workingTimeText = await workingTimeTerm
					.locator('~ .c-definitionList__description')
					.first()
					.textContent({ timeout: 5000 });
				
				return workingTimeText?.trim() || "";
			}
		} catch {}
		
		return "";
	}

	async getPeriodText(): Promise<string> {
		try {
			// 期間を取得（時間報酬制の場合）
			const periodTerm = await this.page
				.locator('.c-definitionList__term')
				.filter({ hasText: /^期間$/ })
				.first();
			
			if (await periodTerm.isVisible({ timeout: 3000 })) {
				const periodText = await periodTerm
					.locator('~ .c-definitionList__description')
					.first()
					.textContent({ timeout: 5000 });
				
				return periodText?.trim() || "";
			}
		} catch {}
		
		return "";
	}

	async getDescription(): Promise<string> {
		try {
			// 仕事内容のセクションを取得
			const descriptionSection = await this.page
				.locator('.p-jobdetail__content')
				.innerHTML({ timeout: 5000 });
			
			if (descriptionSection) {
				return descriptionSection.trim();
			}
		} catch {}
		
		// 別のセレクタを試す
		try {
			const altDescription = await this.page
				.locator('.job-description')
				.innerHTML({ timeout: 5000 });
			
			if (altDescription) {
				return altDescription.trim();
			}
		} catch {}
		
		// それでも見つからない場合は、本文全体から取得
		try {
			const mainContent = await this.page
				.locator('main')
				.innerHTML({ timeout: 5000 });
			
			return mainContent?.trim() || "";
		} catch {
			return "";
		}
	}
}