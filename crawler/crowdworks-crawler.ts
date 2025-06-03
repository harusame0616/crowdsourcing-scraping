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
			}
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

		console.log("[CrowdWorksCrawler] Extracting data from page...");
		const data = await page.evaluate(() => {
				const getText = (selector: string) => {
					const el = document.querySelector(selector);
					return el?.textContent?.trim() || "";
				};

				const getHtml = (selector: string) => {
					const el = document.querySelector(selector);
					return el?.innerHTML?.trim() || "";
				};

				const getNextTdText = (thText: string) => {
					const ths = Array.from(document.querySelectorAll("th"));
					const th = ths.find((el) => el.textContent?.includes(thText));
					if (th) {
						const td = th.nextElementSibling;
						return td?.textContent?.trim() || "";
					}
					return "";
				};

				const title = document.title.split("| 在宅")[0].trim();
				const isHidden = title.includes("非公開のお仕事"); // Check if recruiting by looking for the end recruitment text
				const spans = Array.from(document.querySelectorAll("span"));
				const isRecruiting = !spans.some((span) =>
					span.textContent?.includes("このお仕事の募集は終了しています。"),
				);
				const hasFixedWage = !!getNextTdText("固定報酬制");

				const result = {
					title,
					isHidden,
					category: getText(".subtitle>a"),
					fixedBudgetText: getNextTdText("固定報酬制"),
					hourlyBudgetText: getNextTdText("時間単価制"),
					deliveryDateText: getNextTdText("納品希望日"),
					recruitingLimitText: getNextTdText("応募期限"),
					publicationDateText: getNextTdText("掲載日"),
					workingTimeText: getNextTdText("稼働時間/週"),
					periodText: getNextTdText("期間"),
					description: getHtml(".confirm_outside_link"),
					isRecruiting,
					hasFixedWage,
				};
				return result;
			});

			console.log(
				"[CrowdWorksCrawler] Raw data extracted:",
				JSON.stringify(data, null, 2),
			);

			if (data.isHidden) {
				return {
					platform: Platform.CrowdWorks,
					projectId,
					hidden: true,
				};
			}

			console.log("[CrowdWorksCrawler] Processing dates...");
			const recruitingLimit = toDate(data.recruitingLimitText);
			const publicationDate = toDate(data.publicationDateText);

			const wageType = data.hasFixedWage ? WageType.Fixed : WageType.Time;
			console.log(`[CrowdWorksCrawler] Wage type: ${wageType}`);

			const projectVisible: ProjectVisible = {
				platform: Platform.CrowdWorks,
				projectId,
				hidden: false,
				title: data.title,
				recruitingLimit,
				category: data.category,
				description: data.description,
				publicationDate,
				isRecruiting: data.isRecruiting,
			};

			if (wageType === WageType.Fixed) {
				console.log("[CrowdWorksCrawler] Processing fixed wage project...");
				const budget = rawBudgetToBudget(data.fixedBudgetText);
				const rawDeliveryDate = data.deliveryDateText;
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
			const hourlyBudget = rawHourlyBudgetToBudget(data.hourlyBudgetText);
			const workingTime = toWorkingTime(data.workingTimeText);
			const period = toPeriod(data.periodText);

			return {
				wageType: WageType.Time,
				hourlyBudget,
				workingTime,
				period,
				...projectVisible,
			};
	}
}
