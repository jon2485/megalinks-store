"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {EditorialTableContext} from './table-presentation'

const TableLabelsContext = React.createContext<string[]>([])
function flatChildren(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).flatMap(child => React.isValidElement<{children?:React.ReactNode}>(child) && child.type === React.Fragment ? flatChildren(child.props.children) : [child])
}
function textLabel(node: React.ReactNode): string {
  return typeof node === 'string' || typeof node === 'number' ? String(node) : React.isValidElement<{children?:React.ReactNode}>(node) ? flatChildren(node.props.children).map(textLabel).join(' ') : ''
}
function labelsIn(children: React.ReactNode): string[] {
  return flatChildren(children).flatMap(child => !React.isValidElement<{children?:React.ReactNode}>(child) ? [] : child.type === TableHead || child.type === 'th' ? [textLabel(child.props.children)] : labelsIn(child.props.children))
}

function labelNativeRows(children:React.ReactNode,labels:string[]):React.ReactNode {
  return flatChildren(children).map(child=>{
    if(!React.isValidElement<{children?:React.ReactNode}>(child))return child
    if(child.type==='tr')return React.cloneElement(child,{},flatChildren(child.props.children).map((cell,index)=>React.isValidElement<Record<string,unknown>>(cell)&&cell.type==='td'?React.cloneElement(cell,{'data-label':labels[index]||'פעולות'}):cell))
    return child.props.children ? React.cloneElement(child,{},labelNativeRows(child.props.children,labels)) : child
  })
}
/** Same table and handlers; only opt-in administration receives phone labels. */
export function AdminResponsiveTable({children,...props}:React.ComponentProps<'table'>) {
  const editorial=React.useContext(EditorialTableContext)
  return <table {...props} data-admin-cards={editorial||undefined}>{editorial?labelNativeRows(children,labelsIn(children)):children}</table>
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const editorial = React.useContext(EditorialTableContext)
  return (
    <TableLabelsContext.Provider value={editorial ? labelsIn(props.children) : []}>
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        data-admin-cards={editorial || undefined}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
    </TableLabelsContext.Provider>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  const labels = React.useContext(TableLabelsContext)
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    >{labels.length ? flatChildren(props.children).map((child,index) => React.isValidElement<Record<string,unknown>>(child) && child.type === TableCell ? React.cloneElement(child, {'data-label':labels[index] || 'פעולות'}) : child) : props.children}</tr>
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
