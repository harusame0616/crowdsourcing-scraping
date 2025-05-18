import type { Platform } from "./platform";
import type { WageType, WorkingTime } from "./wage";

export type Budget = {
	min: number | undefined;
	max: number | undefined;
};
export type ProjectCommon = {
	platform: Platform;
	url: string;
	title: string;
	category: string;
	recruitingLimit: string | null;
	description: string;
	publicationDate: string;
	isRecruiting: boolean;
};
export type Period = {
	min: number | undefined;
	max: number | undefined;
};

export type ProjectFixedWage = ProjectCommon & {
	wageType: typeof WageType.Fixed;
	budget: Budget | undefined;
	deliveryDate: string | undefined;
};

export type ProjectTimeWage = ProjectCommon & {
	wageType: typeof WageType.Time;
	workingTime: WorkingTime | undefined;
	hourlyBudget: Budget | undefined;
	period: Period | undefined;
};

type ProjectHidden = {
	platform: Platform;
	url: string;
	visibility: "hidden";
};

export type Project = ProjectFixedWage | ProjectTimeWage | ProjectHidden;
