export const Platform = {
	Coconala: "coconala",
	CrowdWorks: "crowdworks",
	Lancers: "lancers",
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];
