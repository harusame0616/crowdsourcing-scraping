import prisma from "@/lib/prisma";
import { Platform } from "../../../project";
import { Platform as PlatformPrisma } from "@/generated/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";

export async function ProjectDetail({
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

	const url =
		platform === Platform.Coconala
			? `https://coconala.com/projects/${project.projectId}`
			: `https://crowdworks.jp/public/jobs/${project.projectId}`;

	if (project.visible === null) {
		return <div>非公開案件</div>;
	}

	return (
		<div>
			<div className="">
				<div className="flex gap-4">
					<Link href={url} target="_blank">
						{project.visible.title}
					</Link>
					<Button
						variant="outline"
						size="sm"
						onClick={async () => {
							"use server";
							await prisma.projectIgnore.create({
								data: {
									projectId: project.projectId,
									platform: project.platform,
								},
							});
							revalidatePath("/projects");
						}}
					>
						無視
					</Button>
				</div>
			</div>
			<div
				className="whitespace-pre-wrap"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
				dangerouslySetInnerHTML={{
					__html: project.visible.description,
				}}
			/>
		</div>
	);
}
