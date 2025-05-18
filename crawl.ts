import { CrowdWorksCrawler } from "./crawler/crowdworks-crawler";
import { CoconalaCrawler } from "./crawler/coconala-crawler";
import { setTimeout } from "node:timers/promises";
import type { Project } from "./project";
import type { Crawler } from "./crawler/crawler";

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
			await setTimeout(500);
		}

		const projects: Project[] = [];
		for (const projectUrl of projectUrls) {
			projects.push(await this.crawler.detail(projectUrl));
			await setTimeout(500);
		}

		await this.repo.saveMany(projects);
	}
}

async function main() {
	// const crawler = new CoconalaCrawler();
	const coconalaCrawlUsecase = new CrawlingUsecase(new CoconalaCrawler(), [], {
		saveMany: async (projects: Project[]) => {
			console.log(JSON.stringify(projects, null, 2));
		},
	});

	const crowdworksCrawlUsecase = new CrawlingUsecase(
		new CrowdWorksCrawler(),
		[
			"https://crowdworks.jp/public/jobs/search?category_id=2&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=2&order=new&page=2",
			"https://crowdworks.jp/public/jobs/search?category_id=83&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=83&order=new&page=2",
			"https://crowdworks.jp/public/jobs/search?category_id=282&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=173&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=78&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=346&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=347&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=348&order=new",
			"https://crowdworks.jp/public/jobs/search?category_id=269&order=new",
		],
		{
			saveMany: async (projects: Project[]) => {
				console.log(JSON.stringify(projects, null, 2));
			},
		},
	);

	await Promise.all([
		coconalaCrawlUsecase.execute(),
		crowdworksCrawlUsecase.execute(),
	]);
}

main();
