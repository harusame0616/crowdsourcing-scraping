import { ProjectDetailContainer } from "@/app/projects/project-detail";
import type { Platform } from "../../../../../../project";

function NextPage({ params }: { params: { platform: string; id: string } }) {
	return (
		<div>
			<ProjectDetailContainer
				projectId={params.id}
				platform={params.platform as Platform}
			/>
		</div>
	);
}

export default NextPage;
