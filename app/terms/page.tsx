import Workspace from '../workspace';
import {publicMetadata} from '@/lib/seo';
export const metadata=publicMetadata('/terms');

export default function Terms(){return <Workspace initialCatalog={[]} initialView="terms"/>}
