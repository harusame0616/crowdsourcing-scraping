import type { Browser } from "playwright";
import type { Budget, Project } from "../../share/project";
import { Platform, WageType } from "../../share/project";
import type { Crawler } from "./crawler";
import { CoconalaDetailPOM } from "./coconala-detail-pom";

function jpMoneyUnitToNumber(jpMoneyUnit: string): number {
	const m = jpMoneyUnit.match(/(\d+)万(\d+)千円/);

	if (!m)
		return Number.parseInt(
			jpMoneyUnit
				.replace(/万円/g, "0000") // 5万円 -> 50000
				.replace(/千円/g, "000") // 5千円 -> 5000
				.replace(/,/g, ""), // 1,000 -> 1000
		);
	const [, man, sen] = m;
	return Number.parseInt(`${man}${sen}000`);
}

function toBudget(rawBudget: string): Budget | undefined {
	if (rawBudget === "見積り希望") {
		return undefined;
	}

	if (rawBudget.includes("未満")) {
		const value = rawBudget.split("未満")[0]; // ５千円未満 -> [5千円, 未満]
		// 5千円、1万5千円、1万円のケースに対応
		return {
			min: undefined,
			max: jpMoneyUnitToNumber(value),
		};
	}
	if (rawBudget.includes("〜")) {
		const [min, max] = rawBudget
			.split("〜")
			.map((text) => jpMoneyUnitToNumber(text.trim()));

		return { min, max };
	}

	// 金額指定
	return {
		min: jpMoneyUnitToNumber(rawBudget),
		max: jpMoneyUnitToNumber(rawBudget),
	};
}

// 2025年1月1日 -> 2025-01-01
function jpDateStringToDate(jpDate: string) {
	console.log(`[DateParser] Input: "${jpDate}"`);

	if (!jpDate || jpDate.trim() === "") {
		console.log("[DateParser] Empty date string, returning null");
		return null;
	}

	const m = jpDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!m) {
		console.error(`[DateParser] Failed to parse date: "${jpDate}"`);
		throw new Error(`Invalid date format: "${jpDate}"`);
	}

	const [, year, month, day] = m;
	return new Date(
		`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000+09:00`,
	);
}

export class CoconalaCrawler implements Crawler {
	constructor(private browser: Browser) {}

	private async createPageResource() {
		const page = await this.browser.newPage();
		return {
			page,
			[Symbol.asyncDispose]: async () => {
				await page.close();
			},
		};
	}

	async listProjectUrls(url: string): Promise<string[]> {
		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log("[Coconala Crawler].listProjectUrls 開始", { url });
		await page.goto(url);

		console.log("[Coconala Crawler].listProjectUrls 一覧データ取得");
		const titlesLocator = page.locator(".c-itemInfo_title");
		const noHitLocator = page.getByText("該当する仕事が見つかりませんでした。");

		await Promise.race([
			titlesLocator.first().waitFor({ state: "visible" }).catch(),
			noHitLocator.waitFor({ state: "visible" }).catch(),
		]);

		if (await noHitLocator.isVisible()) {
			console.log("[Coconala Crawler].listProjectUrls ヒットなし");
			return [];
		}

		console.log("[Coconala Crawler].listProjectUrls プロジェクト ID 取得開始");
		const titleLocators = await titlesLocator.all();
		const projectIds = await Promise.all(
			titleLocators.map(async (titleLocator) => {
				const href = await titleLocator.getByRole("link").getAttribute("href");

				if (href === null) {
					throw new Error("href is null");
				}

				return href.replace("https://coconala.com/requests/", "");
			}),
		);

		console.log("[Coconala Crawler].listProjectUrls プロジェクト ID 取得完了", {
			projectIds,
		});

		return projectIds;
	}

	async detail(projectId: string): Promise<Project> {
		const url = `https://coconala.com/requests/${projectId}`;

		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log(`[Coconala Crawler] 詳細ページ表示 ${url}`);
		await page.goto(url);

		const detailPOM = new CoconalaDetailPOM(page);

		const titleText = await detailPOM.getTitle();
		console.log(`[Coconala Crawler] タイトル: ${titleText}`);

		const categoryText = await detailPOM.getCategory();
		console.log(`[Coconala Crawler] カテゴリ: ${categoryText}`);

		const budgetText = await detailPOM.getBudget();
		console.log(`[Coconala Crawler] 予算: ${budgetText}`);

		const deliveryDateText = await detailPOM.getDeliveryDate();
		console.log(`[Coconala Crawler] 納品期日: ${deliveryDateText}`);

		const recruitingLimitText = await detailPOM.getRecruitingLimit();
		console.log(`[Coconala Crawler] 締切日: ${recruitingLimitText}`);

		const publicationDateText = await detailPOM.getPublicationDate();
		console.log(`[Coconala Crawler] 掲載日: ${publicationDateText}`);

		const description = await detailPOM.getDescription();
		console.log(`[Coconala Crawler] 説明: ${description}`);

		const budget = toBudget(budgetText || "");
		console.log(`[Coconala Crawler] Budget: ${JSON.stringify(budget)}`);

		const deliveryDate =
			deliveryDateText === "ご相談"
				? undefined
				: jpDateStringToDate(deliveryDateText || "");

		const recruitingLimit = jpDateStringToDate(recruitingLimitText || "");

		const publicationDate = jpDateStringToDate(publicationDateText || "");
		if (publicationDate === null) {
			throw new Error(
				`[Coconala Crawler] 掲載日が不正です: ${publicationDateText}`,
			);
		}

		return {
			projectId,
			platform: Platform.Coconala,
			hidden: false as const,
			wageType: WageType.Fixed,
			title: titleText?.trim() || "",
			category: categoryText?.trim() || "",
			budget,
			deliveryDate: deliveryDate || undefined,
			recruitingLimit: recruitingLimit || null,
			description: description.trim(),
			publicationDate,
			isRecruiting: true,
		};
	}
}
