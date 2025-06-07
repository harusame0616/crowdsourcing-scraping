import type { Browser } from "playwright";
import type {
	Budget,
	Period,
	Project,
	ProjectVisible,
	WorkingTime,
} from "../../share/project";
import { Platform, WageType } from "../../share/project";
import type { Crawler } from "./crawler";
import { CrowdWorksDetailPOM } from "./crowdworks-detail-pom";

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

		const pom = new CrowdWorksDetailPOM(page);

		const title = await pom.getTitle();
		console.log(`[Crowdworks] title: ${title}`);

		if (await pom.isHiddenProject(title)) {
			return {
				platform: Platform.CrowdWorks,
				projectId,
				hidden: true,
			};
		}

		const isRecruiting = await pom.isRecruiting();
		console.log(`[Crowdworks] isRecruiting: ${isRecruiting}`);

		const wageType = (await pom.isFixedWageType())
			? WageType.Fixed
			: WageType.Time;
		console.log(`[Crowdworks] wageType: ${wageType}`);

		const category = await pom.getCategory();
		console.log(`[Crowdworks] category: ${category}`);

		const fixedBudgetText = await pom.getFixedBudgetText();
		console.log(`[Crowdworks] fixedBudgetText: ${fixedBudgetText}`);

		const hourlyBudgetText = await pom.getHourlyBudgetText();
		console.log(`[Crowdworks] hourlyBudgetText: ${hourlyBudgetText}`);

		const deliveryDateText = await pom.getDeliveryDateText();
		console.log(`[Crowdworks] deliveryDateText: ${deliveryDateText}`);

		const recruitingLimitText = await pom.getRecruitingLimitText();
		console.log(`[Crowdworks] recruitingLimitText: ${recruitingLimitText}`);

		const publicationDateText = await pom.getPublicationDateText();
		console.log(`[Crowdworks] publicationDateText: ${publicationDateText}`);

		const workingTimeText = await pom.getWorkingTimeText();
		console.log(`[Crowdworks] workingTimeText: ${workingTimeText}`);

		const periodText = await pom.getPeriodText();
		console.log(`[Crowdworks] periodText: ${periodText}`);

		const description = await pom.getDescription();

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
