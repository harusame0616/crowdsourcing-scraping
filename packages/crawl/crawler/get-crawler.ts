import type { Browser } from "playwright";
import { Platform } from "share";
import type { Crawler } from "./crawler";
import { CoconalaCrawler } from "./coconala-crawler";
import { CrowdWorksCrawler } from "./crowdworks-crawler";
import { LancersCrawler } from "./lancers-crawler";

export function getCrawler(platform: Platform, browser: Browser): Crawler {
	switch (platform) {
		case Platform.Coconala:
			return new CoconalaCrawler(browser);
		case Platform.CrowdWorks:
			return new CrowdWorksCrawler(browser);
		case Platform.Lancers:
			return new LancersCrawler(browser);
		default: {
			throw new Error(`Unsupported platform: ${platform satisfies never}`);
		}
	}
}
