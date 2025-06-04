import type { Browser } from "playwright";
import type {
	Budget,
	Period,
	Project,
	ProjectVisible,
	WorkingTime,
} from "../project";
import { Platform, WageType } from "../project";
import type { Crawler } from "./crawler";

function moneyToNumber(text: string): number {
	return Number.parseInt(text.replace(/円|,/g, ""));
}

function toPeriod(rawPeriod: string): Period | undefined {
	if (rawPeriod === "") {
		return undefined;
	}

	const [rawMin, rawMax] = rawPeriod.split("〜");

	let min: number;
	if (rawMin.includes("週間")) {
		min = Number.parseInt(rawMin.replace("週間", ""), 10);
	} else {
		min = Number.parseInt(rawMin.replace("ヶ月", ""), 10) * 4;
	}
	if (rawPeriod.includes("以上")) {
		return { min, max: undefined };
	}

	if (rawPeriod.includes("以内")) {
		return { min: undefined, max: min };
	}

	let max: number;
	if (rawMax.includes("週間")) {
		max = Number.parseInt(rawMax.replace("週間", ""), 10);
	} else {
		max = Number.parseInt(rawMax.replace("ヶ月", ""), 10) * 4;
	}

	return { min, max };
}

function toWorkingTime(rawWorkingHours: string): WorkingTime | undefined {
	if (rawWorkingHours === "") {
		return undefined;
	}

	const [time, unit] = rawWorkingHours.split("/");

	return {
		unit: unit === "週" ? "week" : "month",
		time: Number.parseInt(time),
	};
}

function rawHourlyBudgetToBudget(rawHourlyBudget: string): Budget | undefined {
	if (rawHourlyBudget === "") {
		return undefined;
	}
	if (rawHourlyBudget === "ワーカーと相談する") {
		return undefined;
	}

	if (rawHourlyBudget.includes("〜")) {
		const [min, max] = rawHourlyBudget
			.split("〜")
			.map((text) => moneyToNumber(text.trim()));

		return { min, max };
	}

	throw new Error("Invalid budget format");
}

function rawBudgetToBudget(rawBudget: string): Budget | undefined {
	if (rawBudget === "") {
		return undefined;
	}
	if (rawBudget === "ワーカーと相談する") {
		return undefined;
	}

	// if (rawBudget.includes("未満")) {
	// 	const value = rawBudget.split("未満")[0]; // ５千円未満 -> [5千円, 未満]
	// 	// 5千円、1万5千円、1万円のケースに対応
	// 	return {
	// 		min: undefined,
	// 		max: jpMoneyUnitToNumber(value),
	// 	};
	// }
	if (rawBudget.includes("〜")) {
		const [min, max] = rawBudget
			.split("〜")
			.map((text) => moneyToNumber(text.trim()));

		return { min, max };
	}

	const value = rawBudget.replace(/円|,/g, "");
	return { min: moneyToNumber(value), max: moneyToNumber(value) };
}

// 2025年1月1日 -> 2025-01-01
function toDate(jpDateStr: string) {
	const m = jpDateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!m) {
		throw new Error("Invalid date format");
	}

	const [, year, month, day] = m;
	return new Date(
		`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000+09:00`,
	);
}

export class CrowdWorksCrawler implements Crawler {
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
		console.log(`[CrowdWorksCrawler] プロジェクト一覧を取得します: ${url}`);

		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log("[CrowdWorksCrawler] 一覧ページに移動中...");
		await page.goto(url);

		console.log("[CrowdWorksCrawler] Vueコンテナの読み込みを待機中...");
		const container = await page.locator("#vue-container");
		await container.waitFor({
			timeout: 30000,
		});
		const dataAttr = await container.getAttribute("data");
		if (!dataAttr) {
			throw new Error("data 属性が見つかりません");
		}

		const data = JSON.parse(dataAttr);
		const jobIds = data.searchResult.job_offers.map(
			({ job_offer }: any) => job_offer.id,
		);

		console.log(
			`[CrowdWorksCrawler] ${jobIds.length}件のプロジェクトを取得しました`,
		);
		return jobIds;
	}

	async detail(projectId: string): Promise<Project> {
		const url = `https://crowdworks.jp/public/jobs/${projectId}`;
		console.log(
			`\n[CrowdWorksCrawler] Fetching details for project: ${projectId}`,
		);
		console.log(`[CrowdWorksCrawler] URL: ${url}`);

		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log("[CrowdWorksCrawler] Navigating to detail page...");
		await page.goto(url, { timeout: 60000 });

		console.log(`[Crowdworks] visited`);
		const title = (await page.title()).split("| 在宅")[0].trim();
		console.log(`[Crowdworks] title: ${title}`);

		if (title.includes("非公開のお仕事")) {
			return {
				platform: Platform.CrowdWorks,
				projectId,
				hidden: true,
			};
		}

		const isRecruiting = await page
			.getByText("このお仕事の募集は終了しています。")
			.isHidden();
		console.log(`[Crowdworks] isRecruiting: ${isRecruiting}`);

		const wageType = (await page
			.locator(".summary")
			.getByText("報酬")
			.isVisible())
			? WageType.Fixed
			: WageType.Time;
		console.log(`[Crowdworks] wageType: ${wageType}`);
		const category = await page.locator(".subtitle>a").textContent();
		if (!category) {
			throw new Error("カテゴリが見つかりません");
		}
		console.log(`[Crowdworks] category: ${category}`);
		const fixedBudgetText = (await page.getByText("固定報酬制").isVisible())
			? (await page
					.getByRole("row")
					.filter({ has: page.getByText("固定報酬制") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";
		console.log(`[Crowdworks] fixedBudgetText: ${fixedBudgetText}`);
		const hourlyBudgetText = (await page
			.locator(".summary")
			.getByText("時間単価")
			.isVisible())
			? (await page
					.getByRole("row")
					.filter({ has: page.getByText("時間単価制") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";
		console.log(`[Crowdworks] hourlyBudgetText: ${hourlyBudgetText}`);
		const deliveryDateText = (await page
			.locator(".summary")
			.getByText("納品希望日")
			.isVisible())
			? (await page
					.getByRole("row")
					.filter({ has: page.getByText("納品希望日") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";
		console.log(`[Crowdworks] deliveryDateText: ${deliveryDateText}`);
		const recruitingLimitText = (await page
			.locator(".summary")
			.getByText("応募期限")
			.isVisible())
			? (await page
					.getByRole("row")
					.filter({ has: page.getByText("応募期限") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";
		if (!recruitingLimitText) {
			throw new Error("応募期限が見つかりません");
		}
		console.log(`[Crowdworks] recruitingLimitText: ${recruitingLimitText}`);
		const publicationDateText = (await page
			.locator(".summary")
			.getByText("掲載日")
			.isVisible())
			? (await page
					.getByRole("row")
					.filter({ has: page.getByText("掲載日") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";
		if (!publicationDateText) {
			throw new Error("掲載日が見つかりません");
		}
		console.log(`[Crowdworks] publicationDateText: ${publicationDateText}`);
		const workingTimeText = (await page
			.locator(".summary")
			.getByText("稼働時間/週")
			.isVisible())
			? (await page
					.getByRole("row")
					.filter({ has: page.getByText("稼働時間/週") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";
		console.log(`[Crowdworks] workingTimeText: ${workingTimeText}`);
		const periodText = (await page
			.locator(".summary")
			.getByText("期間")
			.isVisible())
			? (await page
					.locator(".summary")
					.getByRole("row")
					.filter({ has: page.getByText("期間") })
					.getByRole("cell")
					.nth(1)
					.textContent()
					.then((text) => text?.trim())) || ""
			: "";

		console.log(`[Crowdworks] periodText: ${periodText}`);
		const description = await page
			.locator(".confirm_outside_link")
			.innerHTML()
			.then((text) => text?.trim());
		if (!description) {
			throw new Error("説明が見つかりません");
		}

		console.log("[CrowdWorksCrawler] Processing dates...");
		const recruitingLimit = toDate(recruitingLimitText);
		const publicationDate = toDate(publicationDateText);

		const projectVisible: ProjectVisible = {
			platform: Platform.CrowdWorks,
			projectId,
			hidden: false,
			title,
			recruitingLimit,
			category,
			description,
			publicationDate,
			isRecruiting,
		};

		if (wageType === WageType.Fixed) {
			console.log("[CrowdWorksCrawler] Processing fixed wage project...");
			const budget = rawBudgetToBudget(fixedBudgetText);
			const rawDeliveryDate = deliveryDateText;
			const deliveryDate =
				rawDeliveryDate === "-" || rawDeliveryDate === ""
					? undefined
					: toDate(rawDeliveryDate);

			return {
				wageType: WageType.Fixed,
				budget,
				deliveryDate,
				...projectVisible,
			};
		}

		console.log("[CrowdWorksCrawler] Processing hourly wage project...");
		const hourlyBudget = rawHourlyBudgetToBudget(hourlyBudgetText);
		const workingTime = toWorkingTime(workingTimeText);
		const period = toPeriod(periodText);

		return {
			wageType: WageType.Time,
			hourlyBudget,
			workingTime,
			period,
			...projectVisible,
		};
	}
}
