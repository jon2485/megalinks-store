import Workspace from '../workspace';
import {legalMetadata} from '@/lib/seo';
export const metadata=legalMetadata('supply');

export default function Page(){return <Workspace initialCatalog={[]} initialView="supply"/>}
