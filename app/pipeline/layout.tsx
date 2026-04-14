import { type ReactNode } from "react"
import { PipelineProvider } from "./context"

export default function PipelineLayout({ children }: { children: ReactNode }) {
  return <PipelineProvider>{children}</PipelineProvider>
}
