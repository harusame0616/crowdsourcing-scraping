import { PrismaClient, Platform as PrismaPlatform } from "@/generated/prisma";
import {
	Platform,
	type ProjectFixedWage,
	type Project,
	type ProjectHidden,
	WageType,
	type ProjectTimeWage,
	WorkingTimeUnit,
} from "../../../project";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
export default async function NextPage() {
	const prisma = new PrismaClient();
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
			ignore: null,
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
			<ProjectTable projects={projects} />
		</div>
	);
}

function ProjectTable({ projects }: { projects: Project[] }) {
	return (
		<Table>
			<TableCaption>A list of your recent invoices.</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead className="w-[100px]">プラットフォーム</TableHead>
					<TableHead className="w-[100px]">タイトル</TableHead>
					<TableHead>カテゴリ</TableHead>
					<TableHead className="text-right">報酬タイプ</TableHead>
					<TableHead className="text-right">公開日</TableHead>
					<TableHead className="text-right">無視</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{projects.map((project) => {
					const url =
						project.platform === Platform.Coconala
							? `https://coconala.com/requests/${project.projectId}`
							: `https://crowdworks.jp/public/jobs/${project.projectId}`;
					return (
						<TableRow key={project.projectId}>
							{project.hidden ? (
								<>
									<TableCell>
										<Link href={url} target="_blank" className="underline">
											{project.platform === Platform.Coconala
												? "coconala"
												: "クラウドワークス"}
										</Link>
									</TableCell>
									<TableCell>非公開</TableCell>
									<TableCell>-</TableCell>
									<TableCell>-</TableCell>
									<TableCell>-</TableCell>
									<TableCell>-</TableCell>
								</>
							) : (
								<>
									<TableCell>
										<Link href={url} target="_blank" className="underline">
											{project.platform === Platform.Coconala
												? "coconala"
												: "クラウドワークス"}
										</Link>
									</TableCell>
									<TableCell>{project.title}</TableCell>
									<TableCell>{project.category}</TableCell>
									<TableCell>
										{project.wageType === WageType.Fixed
											? "固定報酬"
											: "時間報酬"}
									</TableCell>
									<TableCell>{project.publicationDate.toISOString()}</TableCell>
									<TableCell>
										<Button
											type="button"
											onClick={async () => {
												"use server";

												const prisma = new PrismaClient();
												await prisma.projectIgnore.create({
													data: {
														projectId: project.projectId,
														platform:
															project.platform === Platform.Coconala
																? PrismaPlatform.Coconala
																: PrismaPlatform.CrowdWorks,
													},
												});
												revalidatePath("/projects");
											}}
										>
											無視
										</Button>
									</TableCell>
								</>
							)}
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
}
