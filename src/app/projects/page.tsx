import prisma from "@/lib/prisma";
import {
	Platform,
	type Project,
	type ProjectFixedWage,
	type ProjectHidden,
	type ProjectTimeWage,
	WageType,
	WorkingTimeUnit,
} from "../../../project";
import { Projects } from "./projects";
export default async function NextPage() {
	const prismaProjects = await prisma.project.findMany({
		include: {
			hidden: true,
			visible: {
				include: {
					fixedWage: true,
					timeWage: true,
				},
			},
		},
		orderBy: {
			visible: {
				publicationDate: "desc",
			},
		},
		where: {
			OR: [
				{
					ignore: null,
					visible: {
						isRecruiting: true,
					},
				},
				{ hidden: {} },
			],
		},
	});

	const projects: Project[] = prismaProjects.map((project) => {
		if (project.hidden) {
			return {
				projectId: project.projectId,
				platform:
					project.platform === "Coconala"
						? Platform.Coconala
						: Platform.CrowdWorks,
				hidden: true,
			} satisfies ProjectHidden;
		}

		if (project.visible) {
			if (project.visible.fixedWage) {
				return {
					projectId: project.projectId,
					platform:
						project.platform === "Coconala"
							? Platform.Coconala
							: Platform.CrowdWorks,
					hidden: false,
					wageType: WageType.Fixed,
					budget: {
						min: project.visible.fixedWage.budgetMin ?? undefined,
						max: project.visible.fixedWage.budgetMax ?? undefined,
					},
					deliveryDate: project.visible.fixedWage.deliveryDate ?? undefined,
					title: project.visible.title,
					category: project.visible.category,
					recruitingLimit: project.visible.recruitingLimit,
					description: project.visible.description,
					publicationDate: project.visible.publicationDate,
					isRecruiting: project.visible.isRecruiting,
				} satisfies ProjectFixedWage;
			}

			if (project.visible.timeWage) {
				return {
					projectId: project.projectId,
					platform:
						project.platform === "Coconala"
							? Platform.Coconala
							: Platform.CrowdWorks,
					hidden: false,
					wageType: WageType.Time,
					workingTime:
						project.visible.timeWage.workingTime === null
							? undefined
							: {
									unit: WorkingTimeUnit.Weekly,
									time: project.visible.timeWage.workingTime,
								},
					hourlyBudget: {
						min: project.visible.timeWage.budgetMin ?? undefined,
						max: project.visible.timeWage.budgetMax ?? undefined,
					},
					period: {
						min: project.visible.timeWage.periodMin ?? undefined,
						max: project.visible.timeWage.periodMax ?? undefined,
					},
					title: project.visible.title,
					category: project.visible.category,
					recruitingLimit: project.visible.recruitingLimit,
					description: project.visible.description,
					publicationDate: project.visible.publicationDate,
					isRecruiting: project.visible.isRecruiting,
				} satisfies ProjectTimeWage;
			}

			throw new Error("Invalid project");
		}

		throw new Error("Invalid project");
	});

	return (
		<div>
			<Projects projects={projects} />
		</div>
	);
}
