import * as cheerio from "cheerio";
import type { Budget, Project } from "../project";
import { Platform, WageType } from "../project";
import type { Crawler } from "./crawler";

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
	const m = jpDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!m) {
		throw new Error("Invalid date format");
	}

	const [, year, month, day] = m;
	return new Date(
		`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000+09:00`,
	);
}

export class CoconalaCrawler implements Crawler {
	async listProjectUrls(url: string): Promise<string[]> {
		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Failed to fetch page: ${response.status}`);
			}

			const html = await response.text();
			const $ = cheerio.load(html);

			const links: string[] = [];

			const projectId = $(".c-searchItem_detailLink")
				.map((_, element) => {
					const relativeUrl = $(element).attr("href");
					if (!relativeUrl) {
						throw new Error("relativeUrl is undefined");
					}
					return relativeUrl.replace("https://coconala.com/requests/", "");
				})
				.get()
				.filter(Boolean);

			links.push(...projectId);

			return links;
		} catch (error) {
			console.error(`Error scraping: ${error.message}`);
			return [];
		}
	}

	async detail(projectId: string): Promise<Project> {
		const url = `https://coconala.com/requests/${projectId}`;
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const title = $(".c-requestTitle_heading").text().trim();
		const category = $(".c-requestTitle_category").text().trim();
		const budget = toBudget(
			$(".c-requestOutlineRowContent_budget").text().trim(),
		);
		const rawDeliveryDate = $(".c-requestOutlineRow_content:nth(1)")
			.text()
			.trim();
		const deliveryDate =
			rawDeliveryDate === "ご相談"
				? undefined
				: jpDateStringToDate(rawDeliveryDate);
		const recruitingLimit = jpDateStringToDate(
			$(".c-requestOutlineRowContent_additional>span").text().trim(),
		);
		const publicationDate = jpDateStringToDate(
			$(".c-requestOutlineRowContent_additional")
				.text()
				.split("掲載日")[1]
				.trim(),
		);
		const description = $(".c-detailRowContentText").html()?.trim();
		const isRecruiting = !$(".c-requestOutlineRow_content:nth(2)")
			.text()
			.trim()
			.includes("募集終了");

		return {
			projectId,
			platform: Platform.Coconala,
			hidden: false,
			wageType: WageType.Fixed,
			url,
			title,
			category,
			budget,
			deliveryDate,
			recruitingLimit,
			description,
			publicationDate,
			isRecruiting,
		};
	}
}
