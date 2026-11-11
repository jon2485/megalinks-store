import Workspace from '../workspace';
import {legalMetadata} from '@/lib/seo';
export const metadata=legalMetadata('cancellation');

export default function Page(){return <Workspace initialCatalog={[]} initialView="cancellation"/>}
