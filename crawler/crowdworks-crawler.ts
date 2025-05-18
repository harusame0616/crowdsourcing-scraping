import * as cheerio from "cheerio";
import type {
	Budget,
	Period,
	Project,
	ProjectCommon,
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
		unit: unit === "週" ? "Weekly" : "Monthly",
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
function jpDateToHyphenDate(jpDate: string) {
	const m = jpDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!m) {
		throw new Error("Invalid date format");
	}

	const [, year, month, day] = m;
	return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export class CrowdWorksCrawler implements Crawler {
	async listProjectUrls(url: string): Promise<string[]> {
		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to fetch page: ${response.status}`);
			}

			const html = await response.text();
			const $ = cheerio.load(html);
			const data = $("#vue-container").attr("data");
			if (!data) {
				throw new Error("data is undefined");
			}
			const jobIds: string[] = JSON.parse(data).searchResult.job_offers.map(
				({ job_offer }) => job_offer.id,
			);

			return jobIds.map((id) => `https://crowdworks.jp/public/jobs/${id}`);
		} catch (error) {
			console.error(`Error scraping: ${error.message}`);
			return [];
		}
	}

	async detail(url: string): Promise<Project> {
		console.log(url);
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const [title] = $("h1").text().trim().split("\n");
		if (title === "非公開のお仕事") {
			return {
				platform: Platform.CrowdWorks,
				url,
				visibility: "hidden",
			};
		}
		const category = $(".subtitle>a").text().trim();
		const budget = rawBudgetToBudget(
			$('th:contains("固定報酬制")').next("td").text().trim(),
		);

		const rawDeliveryDate = $('th:contains("納品希望日")')
			.next("td")
			.text()
			.trim();
		const deliveryDate =
			rawDeliveryDate === "-" || rawDeliveryDate === ""
				? undefined
				: jpDateToHyphenDate(rawDeliveryDate);

		const recruitingLimit = jpDateToHyphenDate(
			$('th:contains("応募期限")').next("td").text().trim(),
		);
		const publicationDate = jpDateToHyphenDate(
			$('th:contains("掲載日")').next("td").text().trim(),
		);
		const description = $(".confirm_outside_link").text().trim();
		const isRecruiting = !$(
			'span:contains("このお仕事の募集は終了しています。")',
		).text();
		const wageType = $('th:contains("固定報酬制")').text().trim()
			? WageType.Fixed
			: WageType.Time;
		const projectCommon: ProjectCommon = {
			platform: Platform.CrowdWorks,
			title,
			url,
			recruitingLimit,
			category,
			description,
			publicationDate,
			isRecruiting,
		};

		if (wageType === WageType.Fixed) {
			return {
				wageType: WageType.Fixed,
				budget,
				deliveryDate,
				...projectCommon,
			};
		}

		const hourlyBudget = rawHourlyBudgetToBudget(
			$('th:contains("時間単価制")').next("td").text().trim(),
		);

		const workingTime = toWorkingTime(
			$('th:contains("稼働時間/週")').next("td").text().trim(),
		);
		const period = toPeriod($('th:contains("期間")').next("td").text().trim());
		return {
			wageType: WageType.Time,
			hourlyBudget,
			workingTime,
			period,
			...projectCommon,
		};
	}
}
