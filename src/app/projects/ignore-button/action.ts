"use server";
import prisma from "@/lib/prisma";
import { Platform as PrismaPlatform } from "@/generated/prisma";
import { Platform } from "../../../../project";
import { revalidatePath } from "next/cache";

type IgnoreProjectActionParams = {
	projectId: string;
	platform: Platform;
};

export async function ignoreProjectAction({
	projectId,
	platform,
}: IgnoreProjectActionParams) {
	const existingIgnore = await prisma.projectIgnore.findFirst({
		where: {
			projectId,
			platform:
				platform === Platform.Coconala
					? PrismaPlatform.Coconala
					: PrismaPlatform.CrowdWorks,
		},
	});
	if (existingIgnore) {
		return;
	}
	await prisma.projectIgnore.create({
		data: {
			projectId,
			platform:
				platform === Platform.Coconala
					? PrismaPlatform.Coconala
					: PrismaPlatform.CrowdWorks,
		},
	});

	revalidatePath("/projects");
	revalidatePath(`/projects/${platform}/${projectId}`);
}
