import type { Page } from "playwright";

export class CrowdWorksDetailPOM {
	constructor(private page: Page) {}

	async getTitle(): Promise<string> {
		return (await this.page.title()).split("| 在宅")[0].trim();
	}

	async isHiddenProject(title: string): Promise<boolean> {
		return title.includes("非公開のお仕事");
	}

	async isRecruiting(): Promise<boolean> {
		return await this.page
			.getByText("このお仕事の募集は終了しています。")
			.isHidden();
	}

	async isFixedWageType(): Promise<boolean> {
		return await this.page
			.locator(".summary")
			.getByText("報酬")
			.isVisible();
	}

	async getCategory(): Promise<string> {
		const category = await this.page.locator(".subtitle>a").textContent();
		if (!category) {
			throw new Error("カテゴリが見つかりません");
		}
		return category;
	}

	async getFixedBudgetText(): Promise<string> {
		const isVisible = await this.page.getByText("固定報酬制").isVisible();
		if (!isVisible) return "";

		const text = await this.page
			.getByRole("row")
			.filter({ has: this.page.getByText("固定報酬制") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		return text?.trim() || "";
	}

	async getHourlyBudgetText(): Promise<string> {
		const isVisible = await this.page
			.locator(".summary")
			.getByText("時間単価")
			.isVisible();

		if (!isVisible) return "";

		const text = await this.page
			.getByRole("row")
			.filter({ has: this.page.getByText("時間単価制") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		return text?.trim() || "";
	}

	async getDeliveryDateText(): Promise<string> {
		const isVisible = await this.page
			.locator(".summary")
			.getByText("納品希望日")
			.isVisible();

		if (!isVisible) return "";

		const text = await this.page
			.getByRole("row")
			.filter({ has: this.page.getByText("納品希望日") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		return text?.trim() || "";
	}

	async getRecruitingLimitText(): Promise<string> {
		const isVisible = await this.page
			.locator(".summary")
			.getByText("応募期限")
			.isVisible();

		if (!isVisible) {
			throw new Error("応募期限が見つかりません");
		}

		const text = await this.page
			.getByRole("row")
			.filter({ has: this.page.getByText("応募期限") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		const result = text?.trim() || "";
		if (!result) {
			throw new Error("応募期限が見つかりません");
		}

		return result;
	}

	async getPublicationDateText(): Promise<string> {
		const isVisible = await this.page
			.locator(".summary")
			.getByText("掲載日")
			.isVisible();

		if (!isVisible) {
			throw new Error("掲載日が見つかりません");
		}

		const text = await this.page
			.getByRole("row")
			.filter({ has: this.page.getByText("掲載日") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		const result = text?.trim() || "";
		if (!result) {
			throw new Error("掲載日が見つかりません");
		}

		return result;
	}

	async getWorkingTimeText(): Promise<string> {
		const isVisible = await this.page
			.locator(".summary")
			.getByText("稼働時間/週")
			.isVisible();

		if (!isVisible) return "";

		const text = await this.page
			.getByRole("row")
			.filter({ has: this.page.getByText("稼働時間/週") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		return text?.trim() || "";
	}

	async getPeriodText(): Promise<string> {
		const isVisible = await this.page
			.locator(".summary")
			.getByText("期間")
			.isVisible();

		if (!isVisible) return "";

		const text = await this.page
			.locator(".summary")
			.getByRole("row")
			.filter({ has: this.page.getByText("期間") })
			.getByRole("cell")
			.nth(1)
			.textContent();

		return text?.trim() || "";
	}

	async getDescription(): Promise<string> {
		const description = await this.page
			.locator(".confirm_outside_link")
			.innerHTML();

		if (!description) {
			throw new Error("説明が見つかりません");
		}

		return description.trim();
	}
}
