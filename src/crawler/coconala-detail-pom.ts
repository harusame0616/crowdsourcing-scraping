import type { Page } from "playwright";

export class CoconalaDetailPOM {
	constructor(private page: Page) {}

	async getTitle(): Promise<string | null> {
		return await this.page.locator(".c-requestTitle_heading").textContent();
	}

	async getCategory(): Promise<string | null> {
		return await this.page.locator(".c-requestTitle_category").textContent();
	}

	async getBudget(): Promise<string | null> {
		const requestRows = this.page.locator(".c-requestOutlineRow");
		return await requestRows
			.filter({ hasText: "予算" })
			.locator(".c-requestOutlineRow_content")
			.textContent()
			.then((text) => text?.trim() || null);
	}

	async getDeliveryDate(): Promise<string> {
		const requestRows = this.page.locator(".c-requestOutlineRow");
		return await requestRows
			.filter({ hasText: "納品希望日" })
			.locator(".c-requestOutlineRow_content")
			.innerText();
	}

	async getRecruitingLimit(): Promise<string | null> {
		const requestRows = this.page.locator(".c-requestOutlineRow");
		return await requestRows
			.filter({ hasText: "募集期限" })
			.locator(".c-requestOutlineRowContent_additional")
			.textContent()
			.then(
				(text) => text?.match(/締切日\s*(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1] || null,
			);
	}

	async getPublicationDate(): Promise<string | null> {
		const requestRows = this.page.locator(".c-requestOutlineRow");
		return await requestRows
			.filter({ hasText: "掲載日" })
			.locator(".c-requestOutlineRowContent_additional")
			.textContent()
			.then(
				(text) => text?.match(/掲載日\s*(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1] || null,
			);
	}

	async getDescription(): Promise<string> {
		return await this.page.locator(".c-detailRowContentText").innerHTML();
	}
}