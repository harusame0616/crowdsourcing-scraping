import { chromium } from "playwright";
import type { Project } from "../share/project";
import type { Crawler } from "./crawler/crawler";
import { getCrawler } from "./crawler/get-crawler";
import { Platform } from "../share/project/platform";
import fs from "node:fs/promises";
import * as v from "valibot";
import pMap from "p-map";

class CrawlingUsecase {
	constructor(
		private readonly crawler: Crawler,
		private readonly listUrls: string[],
		private readonly repo: { saveMany: (project: Project[]) => Promise<void> },
	) {}

	async execute() {
		const projectUrls = (
			await pMap(
				this.listUrls,
				async (listPage) => this.crawler.listProjectUrls(listPage),
				{ concurrency: 10 },
			)
		).flat();

		const projects = await pMap(
			projectUrls,
			async (projectUrl) => this.crawler.detail(projectUrl),
			{ concurrency: 10 },
		);

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

	if (args.length < 2) {
		process.exit(1);
	}

	const platform = v.parse(v.enum(Platform), args[0]);
	const listUrls = args
		.slice(1)
		.map((url) => v.parse(v.pipe(v.string(), v.url()), url));

	console.log("platform:", platform);
	console.log("listUrls:", listUrls);

	await using browserResource = await createBrowserResource();
	const { browser } = browserResource;

	const crawler = getCrawler(platform, browser);

	const crawlUsecase = new CrawlingUsecase(crawler, listUrls, {
		saveMany: async (projects: Project[]) => {
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const filename = `${platform}_batch_${timestamp}.json`;

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
