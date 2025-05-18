import type { Project } from "../project";

export interface Crawler {
	listProjectUrls: (url: string) => Promise<string[]>;
	detail: (url: string) => Promise<Project>;
}
