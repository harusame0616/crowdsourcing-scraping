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
import { LancersDetailPOM } from "./lancers-detail-pom";

function moneyToNumber(text: string): number {
	return Number.parseInt(text.replace(/円|,/g, ""));
}

function toPeriod(rawPeriod: string): Period | undefined {
	if (rawPeriod === "" || rawPeriod === "不問") {
		return undefined;
	}

	// "1ヶ月程度"、"3ヶ月以上"、"1週間〜1ヶ月" などのパターンに対応
	if (rawPeriod.includes("〜")) {
		const [rawMin, rawMax] = rawPeriod.split("〜");
		const min = parsePeriodValue(rawMin);
		const max = parsePeriodValue(rawMax);
		return { min, max };
	}

	if (rawPeriod.includes("以上")) {
		const min = parsePeriodValue(rawPeriod.replace("以上", ""));
		return { min, max: undefined };
	}

	if (rawPeriod.includes("以内") || rawPeriod.includes("未満")) {
		const max = parsePeriodValue(rawPeriod.replace(/以内|未満/, ""));
		return { min: undefined, max };
	}

	if (rawPeriod.includes("程度")) {
		const value = parsePeriodValue(rawPeriod.replace("程度", ""));
		return { min: value, max: value };
	}

	return undefined;
}

function parsePeriodValue(text: string): number {
	const trimmed = text.trim();
	if (trimmed.includes("週間")) {
		return Number.parseInt(trimmed.replace("週間", ""), 10);
	}
	if (trimmed.includes("ヶ月")) {
		return Number.parseInt(trimmed.replace("ヶ月", ""), 10) * 4;
	}
	return 0;
}

function toWorkingTime(rawWorkingHours: string): WorkingTime | undefined {
	if (rawWorkingHours === "" || rawWorkingHours === "不問") {
		return undefined;
	}

	// "週10時間"、"月40時間" などのパターンに対応
	const match = rawWorkingHours.match(/(\d+)時間/);
	if (!match) {
		return undefined;
	}

	const time = Number.parseInt(match[1]);
	const unit = rawWorkingHours.includes("週") ? "week" : "month";

	return { unit, time };
}

function rawBudgetToBudget(rawBudget: string): Budget | undefined {
	if (rawBudget === "" || rawBudget === "相談して決める") {
		return undefined;
	}

	if (rawBudget.includes("〜")) {
		const [min, max] = rawBudget
			.split("〜")
			.map((text) => moneyToNumber(text.trim()));
		return { min, max };
	}

	const value = moneyToNumber(rawBudget);
	return { min: value, max: value };
}

// 2025年01月01日 -> 2025-01-01
function toDate(jpDateStr: string): Date | null {
	if (!jpDateStr || jpDateStr === "なし") {
		return null;
	}

	const m = jpDateStr.match(/(\d{4})年(\d{2})月(\d{2})日/);
	if (!m) {
		throw new Error(`Invalid date format: ${jpDateStr}`);
	}

	const [, year, month, day] = m;
	return new Date(
		`${year}-${month}-${day}T00:00:00.000+09:00`,
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
		console.log(`[LancersCrawler] プロジェクト一覧を取得します: ${url}`);

		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log("[LancersCrawler] 一覧ページに移動中...");
		await page.goto(url, { waitUntil: 'networkidle' });

		// ページが完全に読み込まれるまで待機
		await page.waitForTimeout(3000);

		console.log("[LancersCrawler] プロジェクトリンクを取得中...");
		
		// より汎用的なセレクタを試す
		const selectors = [
			'.c-media__title a',
			'.search-result-list .item-title a',
			'.job-offer-item a',
			'a[href*="/work/detail/"]',
			'.result-item a[href*="/work/detail/"]',
			'.project-item a',
		];

		let projectIds: string[] = [];
		const projectIdSet = new Set<string>(); // 重複を避けるためにSetを使用
		
		for (const selector of selectors) {
			console.log(`[LancersCrawler] セレクタを試しています: ${selector}`);
			const projectLinks = await page.locator(selector).all();
			
			if (projectLinks.length > 0) {
				console.log(`[LancersCrawler] ${projectLinks.length}件のリンクが見つかりました`);
				
				for (const link of projectLinks) {
					const href = await link.getAttribute('href');
					if (href) {
						// URLから project ID を抽出 (/work/detail/5334085 -> 5334085)
						const match = href.match(/\/work\/detail\/(\d+)/);
						if (match) {
							projectIdSet.add(match[1]);
						}
					}
				}
				
				if (projectIdSet.size > 0) {
					projectIds = Array.from(projectIdSet);
					break;
				}
			}
		}

		// プロジェクトが見つからない場合、ページの内容をデバッグ
		if (projectIds.length === 0) {
			console.log("[LancersCrawler] プロジェクトが見つかりません。ページ構造を確認します...");
			
			// ページのタイトルを確認
			const pageTitle = await page.title();
			console.log(`[LancersCrawler] ページタイトル: ${pageTitle}`);
			
			// 検索結果が存在するか確認
			const hasResults = await page.locator('.search-result-none').isVisible().catch(() => false);
			if (hasResults) {
				console.log("[LancersCrawler] 検索結果が0件です");
			}
			
			// すべてのリンクを確認（デバッグ用）
			const allLinks = await page.locator('a[href*="/work/detail/"]').count();
			console.log(`[LancersCrawler] /work/detail/ を含むリンクの総数: ${allLinks}`);
		}

		console.log(
			`[LancersCrawler] ${projectIds.length}件のプロジェクトを取得しました`,
		);
		return projectIds;
	}

	async detail(projectId: string): Promise<Project> {
		const url = `https://www.lancers.jp/work/detail/${projectId}`;
		console.log(
			`\n[LancersCrawler] Fetching details for project: ${projectId}`,
		);
		console.log(`[LancersCrawler] URL: ${url}`);

		await using pageResource = await this.createPageResource();
		const { page } = pageResource;

		console.log("[LancersCrawler] Navigating to detail page...");
		await page.goto(url, { timeout: 60000, waitUntil: 'networkidle' });

		const pom = new LancersDetailPOM(page);

		// 404ページのチェック
		if (await pom.isNotFound()) {
			return {
				platform: Platform.Lancers,
				projectId,
				hidden: true,
			};
		}

		const title = await pom.getTitle();
		console.log(`[Lancers] title: ${title}`);

		const isRecruiting = await pom.isRecruiting();
		console.log(`[Lancers] isRecruiting: ${isRecruiting}`);

		const wageType = (await pom.isFixedWageType())
			? WageType.Fixed
			: WageType.Time;
		console.log(`[Lancers] wageType: ${wageType}`);

		const category = await pom.getCategory();
		console.log(`[Lancers] category: ${category}`);

		const budgetText = await pom.getBudgetText();
		console.log(`[Lancers] budgetText: ${budgetText}`);

		const recruitingLimitText = await pom.getRecruitingLimitText();
		console.log(`[Lancers] recruitingLimitText: ${recruitingLimitText}`);

		const publicationDateText = await pom.getPublicationDateText();
		console.log(`[Lancers] publicationDateText: ${publicationDateText}`);

		const description = await pom.getDescription();

		console.log("[LancersCrawler] Processing dates...");
		const recruitingLimit = toDate(recruitingLimitText);
		const publicationDate = toDate(publicationDateText);

		if (!publicationDate) {
			throw new Error("公開日が見つかりません");
		}

		const projectVisible: ProjectVisible = {
			platform: Platform.Lancers,
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
			console.log("[LancersCrawler] Processing fixed wage project...");
			const budget = rawBudgetToBudget(budgetText);
			
			// Lancersでは納期情報を別途取得する必要がある場合は実装
			const deliveryDate = undefined;

			return {
				wageType: WageType.Fixed,
				budget,
				deliveryDate,
				...projectVisible,
			};
		}

		console.log("[LancersCrawler] Processing time wage project...");
		// 時間報酬の場合の処理
		const hourlyBudget = rawBudgetToBudget(budgetText);
		const workingTimeText = await pom.getWorkingTimeText();
		const periodText = await pom.getPeriodText();
		
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