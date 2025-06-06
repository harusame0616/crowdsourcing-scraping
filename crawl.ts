import { chromium } from "playwright";
import { setTimeout } from "node:timers/promises";
import type { Project } from "./project";
import type { Crawler } from "./crawler/crawler";
import { getCrawler } from "./crawler/get-crawler";
import { Platform } from "./project/platform";
import fs from "node:fs/promises";
import * as v from "valibot";

class CrawlingUsecase {
	constructor(
		private readonly crawler: Crawler,
		private readonly listUrls: string[],
		private readonly repo: { saveMany: (project: Project[]) => Promise<void> },
	) {}

	async execute() {
		const projectUrls: string[] = [];
		for (const listPage of this.listUrls) {
			projectUrls.push(...(await this.crawler.listProjectUrls(listPage)));
			await setTimeout(100);
		}

		const projects: Project[] = [];
		for (const projectUrl of projectUrls) {
			projects.push(await this.crawler.detail(projectUrl));
			await setTimeout(100);
		}

		await this.repo.saveMany(projects);
	}
}

async function createBrowserResource() {
	console.log("Launching browser...");
	const browser = await chromium.launch({
		timeout: 30000,
	});
	return {
		browser,
		[Symbol.asyncDispose]: async () => {
			console.log("Closing browser...");
			await browser.close();
		},
	};
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length !== 2) {
		process.exit(1);
	}

	const platform = v.parse(v.enum(Platform), args[0]);
	const listUrl = v.parse(v.pipe(v.string(), v.url()), args[1]);

	await using browserResource = await createBrowserResource();
	const { browser } = browserResource;

	const crawler = getCrawler(platform, browser);

	const crawlUsecase = new CrawlingUsecase(crawler, [listUrl], {
		saveMany: async (projects: Project[]) => {
			const url = new URL(listUrl);
			const pathPart = url.pathname + url.search;
			const encodedPath = encodeURIComponent(pathPart);
			const filename = `${platform}_${encodedPath}.json`;

			await fs.writeFile(
				`outputs/${filename}`,
				JSON.stringify(projects, null, 2),
				"utf-8",
			);
			console.log(`Saved ${projects.length} projects to ${filename}`);
		},
	});

	await crawlUsecase.execute();
}

main().catch(console.error);
