import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { Fragment } from 'react'

function Tabs({ defaultValue, className, children, ...props }: any) {
    // Headless UI handles state internally or via controlled props. 
    // Adapting to the Shadcn-like API I used in payroll.tsx might be tricky without context.
    // Actually, payroll.tsx uses: <Tabs defaultValue="run"> <TabsList>...</TabsList> <TabsContent value="run">
    // This atomic composition relies on Context. Headless UI provides this context.
    // However, Headless UI mechanism is <Tab.Group> <Tab.List> <Tab>... </Tab.List> <Tab.Panels> <Tab.Panel> ...

    // To keep payroll.tsx exact syntax, I need to wrap Headless UI or build my own context.
    // Building my own simple context is easiest to match the API signature I already wrote.
    return <TabsProvider defaultValue={defaultValue} className={className}>{children}</TabsProvider>
}

import { createContext, useContext, useState } from 'react'

const TabsContext = createContext<any>(null)

function TabsProvider({ defaultValue, children, className }: any) {
    const [activeTab, setActiveTab] = useState(defaultValue)
    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    )
}

function TabsList({ className, children }: any) {
    return (
        <div className={`inline-flex h-9 items-center justify-center rounded-lg bg-zinc-100 p-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 ${className}`}>
            {children}
        </div>
    )
}

function TabsTrigger({ value, children, className }: any) {
    const { activeTab, setActiveTab } = useContext(TabsContext)
    const isActive = activeTab === value
    return (
        <button
            onClick={() => setActiveTab(value)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
            ${isActive
                    ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50'
                    : 'hover:bg-zinc-200 dark:hover:bg-zinc-700'} 
            ${className}`}
        >
            {children}
        </button>
    )
}

function TabsContent({ value, children, className }: any) {
    const { activeTab } = useContext(TabsContext)
    if (activeTab !== value) return null
    return (
        <div className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300 ${className}`}>
            {children}
        </div>
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
