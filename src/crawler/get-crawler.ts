import type { Browser } from "playwright";
import { Platform } from "../project/platform";
import type { Crawler } from "./crawler";
import { CoconalaCrawler } from "./coconala-crawler";
import { CrowdWorksCrawler } from "./crowdworks-crawler";

export function getCrawler(platform: Platform, browser: Browser): Crawler {
	switch (platform) {
		case Platform.Coconala:
			return new CoconalaCrawler(browser);
		case Platform.CrowdWorks:
			return new CrowdWorksCrawler(browser);
		default: {
			throw new Error(`Unsupported platform: ${platform satisfies never}`);
		}
	}
}
