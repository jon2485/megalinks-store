import Workspace from '../workspace';
import {legalMetadata} from '@/lib/seo';
export const metadata=legalMetadata('privacy');

export default function Page(){return <Workspace initialCatalog={[]} initialView="privacy"/>}
