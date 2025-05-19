import { ProjectDetail } from "@/app/projects/project-detail";
import type { Platform } from "../../../../../../project";

function NextPage({ params }: { params: { platform: string; id: string } }) {
	return (
		<div>
			<ProjectDetail
				projectId={params.id}
				platform={params.platform as Platform}
			/>
		</div>
	);
}

export default NextPage;
