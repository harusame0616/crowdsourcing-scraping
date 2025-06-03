import type { Browser } from "playwright";
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
	console.log(`[DateParser] Input: "${jpDate}"`);

	if (!jpDate || jpDate.trim() === "") {
		console.log("[DateParser] Empty date string, returning null");
		return null as any;
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

	async listProjectUrls(url: string): Promise<string[]> {
		let page = null;

		try {
			page = await this.browser.newPage();
			console.log(`[Coconala] 一覧ページ表示 ${url}`);
			await page.goto(url);

			const titlesLocator = page.locator(".c-itemInfo_title");
			const noHitLocator = page.getByText(
				"該当する仕事が見つかりませんでした。",
			);

			console.log("[Coconala] 一覧もしくはヒットなしメッセージ待ち");
			await Promise.race([
				titlesLocator.first().waitFor({ state: "visible" }),
				noHitLocator.waitFor({ state: "visible" }),
			]);

			if (await noHitLocator.isVisible()) {
				console.log("[Coconala] ヒットなし");
				return [];
			}

			console.log("[Coconala] プロジェクト ID 取得開始");
			return await Promise.all(
				(await titlesLocator.all()).map(async (titleLocator) => {
					const href = await titleLocator
						.getByRole("link")
						.getAttribute("href");

					if (href === null) {
						throw new Error("href is null");
					}
					const projectId = href.replace("https://coconala.com/requests/", "");
					console.log(`[Coconala] プロジェクト ID 取得完了: ${projectId}`);

					return projectId;
				}),
			);
		} finally {
			if (page) {
				await page.close();
			}
		}
	}

	async detail(projectId: string): Promise<Project> {
		const url = `https://coconala.com/requests/${projectId}`;
		console.log(
			`\n[CoconalaCrawler] Fetching details for project: ${projectId}`,
		);
		console.log(`[CoconalaCrawler] URL: ${url}`);
		let page = null;

		try {
			page = await this.browser.newPage();
			console.log("[CoconalaCrawler] Navigating to detail page...");
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

			console.log("[CoconalaCrawler] Page loaded, waiting for content...");
			// Wait for main content to load
			await page.waitForSelector(".c-requestTitle_heading", { timeout: 30000 });

			// Additional wait to ensure content is rendered
			await page.waitForTimeout(2000);

			console.log("[CoconalaCrawler] Extracting data from page...");
			const data = await page.evaluate(() => {
				const getText = (selector: string) => {
					console.log({ selector });
					const el = document.querySelector(selector);
					return el?.textContent?.trim() || "";
				};

				const getHtml = (selector: string) => {
					console.log({ selector });
					const el = document.querySelector(selector);
					return el?.innerHTML?.trim() || "";
				};

				const result = {
					title: getText(".c-requestTitle_heading"),
					category: getText(".c-requestTitle_category"),
					budgetText:
						document
							.querySelectorAll(".c-requestOutlineRow_content")[0]
							?.textContent?.trim() || "",
					rawDeliveryDate:
						document
							.querySelectorAll(".c-requestOutlineRow_content")[1]
							?.textContent?.trim() || "",
					recruitingLimitText:
						document
							.querySelector(".c-requestOutlineRowContent_additional")
							?.textContent?.match(
								/締切日\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
							)?.[1] || "",
					publicationDateText:
						document
							.querySelector(".c-requestOutlineRowContent_additional")
							?.textContent?.match(
								/掲載日\s*(\d{4}年\d{1,2}月\d{1,2}日)/,
							)?.[1] || "",
					description: getHtml(".c-detailRowContentText"),
					recruitingStatusText: document
						.querySelectorAll(".c-requestOutlineRow_content")[2]
						?.textContent?.includes("日")
						? "募集中"
						: "募集終了",
				};
				return result;
			});

			console.log(
				"[CoconalaCrawler] Raw data extracted:",
				JSON.stringify(data, null, 2),
			);

			console.log("[CoconalaCrawler] Processing budget...");
			const budget = toBudget(data.budgetText);
			console.log(`[CoconalaCrawler] Budget: ${JSON.stringify(budget)}`);

			console.log("[CoconalaCrawler] Processing delivery date...");
			const deliveryDate =
				data.rawDeliveryDate === "ご相談"
					? undefined
					: jpDateStringToDate(data.rawDeliveryDate);

			console.log("[CoconalaCrawler] Processing recruiting limit...");
			const recruitingLimit = jpDateStringToDate(data.recruitingLimitText);

			console.log("[CoconalaCrawler] Processing publication date...");
			const publicationDate = jpDateStringToDate(data.publicationDateText);

			const isRecruiting = !data.recruitingStatusText.includes("募集終了");
			console.log(`[CoconalaCrawler] Is recruiting: ${isRecruiting}`);

			const result = {
				projectId,
				platform: Platform.Coconala,
				hidden: false,
				wageType: WageType.Fixed,
				title: data.title,
				category: data.category,
				budget,
				deliveryDate,
				recruitingLimit,
				description: data.description,
				publicationDate,
				isRecruiting,
			};

			console.log(
				`[CoconalaCrawler] Successfully extracted project: ${projectId}`,
			);
			return result;
		} catch (error) {
			console.error(
				`[CoconalaCrawler] Error scraping detail page: ${error instanceof Error ? error.message : error}`,
			);
			console.error(`[CoconalaCrawler] Failed on project: ${projectId}`);
			throw error;
		} finally {
			if (page) {
				await page.close();
			}
		}
	}
}
