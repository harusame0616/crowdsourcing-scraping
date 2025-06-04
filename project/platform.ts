export const Platform = {
	Coconala: "coconala",
	CrowdWorks: "crowdworks",
} as const;
export type Platform = (typeof Platform)[keyof typeof Platform];
