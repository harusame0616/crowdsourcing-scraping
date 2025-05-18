import type { Platform } from "./platform";
import type { WageType, WorkingTime } from "./wage";

export type Budget = {
	min: number | undefined;
	max: number | undefined;
};

export type ProjectBase = {
	projectId: string;
	platform: Platform;
};

export type ProjectHidden = ProjectBase & {
	hidden: true;
};

export type ProjectVisible = ProjectBase & {
	hidden: false;
	title: string;
	category: string;
	recruitingLimit: Date | null;
	description: string;
	publicationDate: Date;
	isRecruiting: boolean;
};

export type Period = {
	min: number | undefined;
	max: number | undefined;
};

export type ProjectFixedWage = ProjectVisible & {
	wageType: typeof WageType.Fixed;
	budget: Budget | undefined;
	deliveryDate: Date | undefined;
};

export type ProjectTimeWage = ProjectVisible & {
	wageType: typeof WageType.Time;
	workingTime: WorkingTime | undefined;
	hourlyBudget: Budget | undefined;
	period: Period | undefined;
};

export type Project = ProjectFixedWage | ProjectTimeWage | ProjectHidden;
