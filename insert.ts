import { Platform as PrismaPlatform, PrismaClient } from "@/generated/prisma";

console.log(process.env.DATABASE_URL);
console.log("----");
const prisma = new PrismaClient();
import coconalaProject from "./coconala-2025-05-19.json";
import crowdWorksProject from "./crowdworks-2025-05-19.json";
import { Platform, type Project, WageType } from "./project";

async function main() {
	const projects: Project[] = [...coconalaProject, ...crowdWorksProject];

	for (const project of projects) {
		await prisma.project.upsert({
			where: {
				projectId_platform: {
					projectId: `${project.projectId}`,
					platform:
						project.platform === Platform.Coconala
							? PrismaPlatform.Coconala
							: PrismaPlatform.CrowdWorks,
				},
			},
			create: {
				projectId: `${project.projectId}`,
				platform:
					project.platform === Platform.Coconala
						? PrismaPlatform.Coconala
						: PrismaPlatform.CrowdWorks,
				hidden: project.hidden
					? {
							create: {},
						}
					: undefined,
				visible: !project.hidden
					? {
							create: {
								title: project.title,
								description: project.description,
								category: project.category,
								publicationDate: project.publicationDate,
								isRecruiting: project.isRecruiting,
								fixedWage:
									project.wageType === WageType.Fixed
										? {
												create: {
													budgetMin: project.budget?.min,
													budgetMax: project.budget?.max,
													deliveryDate: project.deliveryDate,
												},
											}
										: undefined,
								timeWage:
									project.wageType === WageType.Time
										? {
												create: {
													workingTime: project.workingTime?.time,
													budgetMin: project.hourlyBudget?.min,
													budgetMax: project.hourlyBudget?.max,
													periodMin: project.period?.min,
													periodMax: project.period?.max,
												},
											}
										: undefined,
							},
						}
					: undefined,
			},
			update: {
				hidden: project.hidden
					? {
							create: {},
						}
					: undefined,
				visible: !project.hidden
					? {
							create: {
								title: project.title,
								description: project.description,
								category: project.category,
								publicationDate: project.publicationDate,
								isRecruiting: project.isRecruiting,
								fixedWage:
									project.wageType === WageType.Fixed
										? {
												create: {
													budgetMin: project.budget?.min,
													budgetMax: project.budget?.max,
													deliveryDate: project.deliveryDate,
												},
											}
										: undefined,
								timeWage:
									project.wageType === WageType.Time
										? {
												create: {
													workingTime: project.workingTime?.time,
													budgetMin: project.hourlyBudget?.min,
													budgetMax: project.hourlyBudget?.max,
													periodMin: project.period?.min,
													periodMax: project.period?.max,
												},
											}
										: undefined,
							},
						}
					: undefined,
			},
		});
	}
}

main();
