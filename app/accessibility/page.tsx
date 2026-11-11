import Workspace from '../workspace';
import {legalMetadata} from '@/lib/seo';
export const metadata=legalMetadata('accessibility');

export default function Page(){return <Workspace initialCatalog={[]} initialView="accessibility"/>}
