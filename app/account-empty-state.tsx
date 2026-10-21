import {FileClock,ListFilter} from 'lucide-react';
export default function AccountEmptyState({kind,title,description}:{kind:'requests'|'transactions';title:string;description:string}){
 const Icon=kind==='requests'?FileClock:ListFilter;
 return <div className="account-empty-state"><span aria-hidden="true"><Icon size={38} strokeWidth={1.5}/></span><h3>{title}</h3><p>{description}</p></div>;
}
