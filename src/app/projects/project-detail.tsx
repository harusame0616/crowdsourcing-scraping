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
import { Platform as PlatformPrisma } from "@/generated/prisma";
import Link from "next/link";
import { IgnoreButton } from "./ignore-button";

export async function ProjectDetailContainer({
	projectId,
	platform,
}: {
	projectId: string;
	platform: Platform;
}) {
	const project = await prisma.project.findUnique({
		include: {
			hidden: true,
			visible: {
				include: {
					fixedWage: true,
					timeWage: true,
				},
			},
		},
		where: {
			projectId_platform: {
				projectId,
				platform:
					platform === Platform.Coconala
						? PlatformPrisma.Coconala
						: PlatformPrisma.CrowdWorks,
			},
		},
	});

	if (!project) {
		return <div>プロジェクトが見つかりません</div>;
	}

	if (project.hidden) {
		return (
			<ProjectDetailPresenter
				project={
					{
						projectId: project.projectId,
						platform:
							project.platform === PlatformPrisma.Coconala
								? Platform.Coconala
								: Platform.CrowdWorks,
						hidden: true,
					} satisfies ProjectHidden
				}
			/>
		);
	}

	if (project.visible?.fixedWage) {
		return (
			<ProjectDetailPresenter
				project={
					{
						projectId: project.projectId,
						platform:
							project.platform === PlatformPrisma.Coconala
								? Platform.Coconala
								: Platform.CrowdWorks,
						hidden: !!project.hidden,
						category: project.visible?.category ?? "",
						description: project.visible?.description ?? "",
						publicationDate: project.visible?.publicationDate ?? new Date(),
						isRecruiting: project.visible?.isRecruiting ?? false,
						title: project.visible?.title ?? "",
						recruitingLimit: project.visible?.recruitingLimit ?? null,
						wageType: WageType.Fixed,
						budget: {
							min: project.visible?.fixedWage?.budgetMin ?? undefined,
							max: project.visible?.fixedWage?.budgetMax ?? undefined,
						},
						deliveryDate: project.visible?.fixedWage?.deliveryDate ?? undefined,
					} satisfies ProjectFixedWage
				}
			/>
		);
	}

	if (project.visible?.timeWage) {
		return (
			<ProjectDetailPresenter
				project={
					{
						projectId: project.projectId,
						platform:
							project.platform === PlatformPrisma.Coconala
								? Platform.Coconala
								: Platform.CrowdWorks,
						hidden: !!project.hidden,
						category: project.visible?.category ?? "",
						description: project.visible?.description ?? "",
						publicationDate: project.visible?.publicationDate ?? new Date(),
						isRecruiting: project.visible?.isRecruiting ?? false,
						title: project.visible?.title ?? "",
						recruitingLimit: project.visible?.recruitingLimit ?? null,
						wageType: WageType.Time,
						workingTime: project.visible?.timeWage?.workingTime
							? {
									unit: WorkingTimeUnit.Weekly,
									time: project.visible?.timeWage?.workingTime,
								}
							: undefined,
						hourlyBudget: {
							min: project.visible?.timeWage?.budgetMin ?? undefined,
							max: project.visible?.timeWage?.budgetMax ?? undefined,
						},
						period: {
							min: project.visible?.timeWage?.periodMin ?? undefined,
							max: project.visible?.timeWage?.periodMax ?? undefined,
						},
					} satisfies ProjectTimeWage
				}
			/>
		);
	}

	throw new Error("Invalid project");
}

export async function ProjectDetailPresenter({
	project,
}: {
	project: Project;
}) {
	const url =
		project.platform === Platform.Coconala
			? `https://coconala.com/projects/${project.projectId}`
			: `https://crowdworks.jp/public/jobs/${project.projectId}`;

	if (project.hidden) {
		return <div>非公開案件</div>;
	}

	return (
		<div>
			<div className="">
				<h1 className="text-2xl font-bold">
					<Link href={url} target="_blank">
						{project.title}
					</Link>
				</h1>
				<div>
					<IgnoreButton
						projectId={project.projectId}
						platform={project.platform}
					/>
				</div>
			</div>
			<div className="overflow-y-auto">
				<div
					// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
					dangerouslySetInnerHTML={{
						__html: project.description,
					}}
				/>
			</div>
		</div>
	);
}
