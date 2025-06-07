export const WageUnit = {
	Hourly: "時間単価制",
	Monthly: "月額制",
} as const;

export const WageType = {
	Time: "time",
	Fixed: "fixed",
} as const;

export type WageType = (typeof WageType)[keyof typeof WageType];

export const WorkingTimeUnit = {
	Weekly: "week",
	Monthly: "month",
} as const;

export type WorkingTimeUnit =
	(typeof WorkingTimeUnit)[keyof typeof WorkingTimeUnit];

export type WorkingTime = {
	unit: WorkingTimeUnit;
	time: number;
};
