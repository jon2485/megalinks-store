import Workspace from '../workspace';
import {legalMetadata} from '@/lib/seo';
export const metadata=legalMetadata('terms');

export default function Terms(){return <Workspace initialCatalog={[]} initialView="terms"/>}
