export const WageUnit = {
	Hourly: "時間単価制",
	Monthly: "月額制",
} as const;

export const WageType = {
	Time: "time",
	Fixed: "fixed",
} as const;

type WageType = (typeof WageType)[keyof typeof WageType];

export type WorkingTime = {
	unit: "Weekly" | "Monthly";
	time: number;
};
