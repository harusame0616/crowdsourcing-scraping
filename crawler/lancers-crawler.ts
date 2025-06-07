import type { Browser } from "playwright";
import type {
	Budget,
	Period,
	Project,
	ProjectVisible,
	WorkingTime,
} from "../packages/share/project";
import { Platform, WageType } from "../packages/share/project";
import type { Crawler } from "./crawler";
import { LancersDetailPom } from "./lancers-detail-pom";
import { LancersListPom } from "./lancers-list-pom";

function moneyToNumber(text: string): number {
	return Number.parseInt(text.replace(/円|,/g, ""));
}

function toBudget(rawBudget: string): Budget | undefined {
	if (!rawBudget || rawBudget === "") {
		return undefined;
	}

	// 時給の場合は処理しない
	if (rawBudget.includes("時給")) {
		return undefined;
	}

	// 範囲指定の場合
	if (rawBudget.includes("~")) {
		const [min, max] = rawBudget
			.split("~")
			.map((text) => moneyToNumber(text.trim()));
		return { min, max };
	}

	// 単一金額の場合
	const value = moneyToNumber(rawBudget);
	return { min: value, max: value };
}

function toHourlyBudget(rawHourlyBudget: string): Budget | undefined {
	if (!rawHourlyBudget || rawHourlyBudget === "") {
		return undefined;
	}

	// "時給 2,000 円" のような形式から数値を抽出
	const match = rawHourlyBudget.match(/時給\s*([\d,]+)\s*円/);
	if (match) {
		const value = moneyToNumber(match[1]);
		return { min: value, max: value };
	}

	return undefined;
}

function toWorkingTime(rawWorkingTime: string): WorkingTime | undefined {
	if (!rawWorkingTime || rawWorkingTime === "") {
		return undefined;
	}

	// "週20時間程度" のような形式から数値を抽出
	const weekMatch = rawWorkingTime.match(/週(\d+)時間/);
	if (weekMatch) {
		return {
			unit: "week",
			time: Number.parseInt(weekMatch[1]),
		};
	}

	// "月80時間程度" のような形式
	const monthMatch = rawWorkingTime.match(/月(\d+)時間/);
	if (monthMatch) {
		return {
			unit: "month",
			time: Number.parseInt(monthMatch[1]),
		};
	}

	return undefined;
}

function toPeriod(rawPeriod: string): Period | undefined {
	if (!rawPeriod || rawPeriod === "") {
		return undefined;
	}

	// "3ヶ月" のような単一期間
	const singleMonthMatch = rawPeriod.match(/^(\d+)ヶ月$/);
	if (singleMonthMatch) {
		const weeks = Number.parseInt(singleMonthMatch[1]) * 4;
		return { min: weeks, max: weeks };
	}

	// "1〜3ヶ月" のような範囲
	const rangeMonthMatch = rawPeriod.match(/(\d+)〜(\d+)ヶ月/);
	if (rangeMonthMatch) {
		const minWeeks = Number.parseInt(rangeMonthMatch[1]) * 4;
		const maxWeeks = Number.parseInt(rangeMonthMatch[2]) * 4;
		return { min: minWeeks, max: maxWeeks };
	}

	// "3ヶ月以上" のような形式
	if (rawPeriod.includes("以上")) {
		const match = rawPeriod.match(/(\d+)ヶ月以上/);
		if (match) {
			const minWeeks = Number.parseInt(match[1]) * 4;
			return { min: minWeeks, max: undefined };
		}
	}

	return undefined;
}

// 2025年1月1日 -> 2025-01-01
function jpDateStringToDate(jpDate: string): Date | null {
	if (!jpDate || jpDate.trim() === "") {
		return null;
	}

	const m = jpDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!m) {
		console.error(`[Lancers] Failed to parse date: "${jpDate}"`);
		return null;
	}

	const [, year, month, day] = m;
	return new Date(
		`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000+09:00`,
	);
}

export class LancersCrawler implements Crawler {
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

		console.log(`[Lancers] 一覧ページ表示 ${url}`);
		await page.goto(url);

		// ページの読み込みを待つ
		await page.waitForLoadState("networkidle");

		const listPom = new LancersListPom(page);
		const projectIds = await listPom.getProjects();

		console.log(
			`[Lancers] ${projectIds.length}件のプロジェクトIDを取得しました`,
		);
		return projectIds;
	}

	async detail(projectId: string): Promise<Project> {
		const url = `https://www.lancers.jp/work/detail/${projectId}`;

		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log(`[Lancers] 詳細ページ表示 ${url}`);
		await page.goto(url);

		const detailPom = new LancersDetailPom(page);

		// 非公開プロジェクトチェック
		if (await detailPom.isHiddenProject()) {
			console.log(`[Lancers] プロジェクト ${projectId} は非公開です`);
			return {
				platform: Platform.Lancers,
				projectId,
				hidden: true,
			};
		}

		const title = await detailPom.getTitle();
		console.log(`[Lancers] タイトル: ${title}`);

		const category = await detailPom.getCategory();
		console.log(`[Lancers] カテゴリ: ${category}`);

		const budgetText = await detailPom.getBudgetText();
		console.log(`[Lancers] 予算: ${budgetText}`);

		const isFixedWage = await detailPom.isFixedWageType();
		console.log(`[Lancers] 固定報酬: ${isFixedWage}`);

		const description = await detailPom.getDescription();
		console.log(`[Lancers] 説明: ${description.substring(0, 100)}...`);

		const recruitingLimitText = await detailPom.getRecruitingLimitText();
		console.log(`[Lancers] 募集期限: ${recruitingLimitText}`);

		const publicationDateText = await detailPom.getPublicationDateText();
		console.log(`[Lancers] 掲載日: ${publicationDateText}`);

		const isRecruiting = await detailPom.isRecruiting();
		console.log(`[Lancers] 募集中: ${isRecruiting}`);

		// 日付の処理
		const publicationDate = jpDateStringToDate(publicationDateText || "");
		if (!publicationDate) {
			throw new Error(
				`[Lancers] 掲載日が取得できませんでした: ${publicationDateText}`,
			);
		}

		// 募集期限は "X日間" という形式なので、掲載日から計算する必要がある
		let recruitingLimit: Date | null = null;
		if (recruitingLimitText) {
			const daysMatch = recruitingLimitText.match(/(\d+)日間/);
			if (daysMatch) {
				const days = Number.parseInt(daysMatch[1]);
				recruitingLimit = new Date(publicationDate);
				recruitingLimit.setDate(recruitingLimit.getDate() + days);
			}
		}

		const projectVisible: ProjectVisible = {
			platform: Platform.Lancers,
			projectId,
			hidden: false,
			title: title || "",
			recruitingLimit,
			category: category || "",
			description,
			publicationDate,
			isRecruiting,
		};

		if (isFixedWage) {
			console.log("[Lancers] 固定報酬プロジェクトとして処理");
			const budget = toBudget(budgetText || "");

			const deliveryDateText = await detailPom.getDeliveryDateText();
			console.log(`[Lancers] 納期: ${deliveryDateText}`);

			const deliveryDate = deliveryDateText
				? jpDateStringToDate(deliveryDateText)
				: undefined;

			return {
				wageType: WageType.Fixed,
				budget,
				deliveryDate: deliveryDate || undefined,
				...projectVisible,
			};
		}

		console.log("[Lancers] 時給制プロジェクトとして処理");
		const hourlyBudget = toHourlyBudget(budgetText || "");

		const workingTimeText = await detailPom.getWorkingTimeText();
		console.log(`[Lancers] 稼働時間: ${workingTimeText}`);
		const workingTime = toWorkingTime(workingTimeText || "");

		const periodText = await detailPom.getPeriodText();
		console.log(`[Lancers] 期間: ${periodText}`);
		const period = toPeriod(periodText || "");

		return {
			wageType: WageType.Time,
			hourlyBudget,
			workingTime,
			period,
			...projectVisible,
		};
	}
}
