import type { Meta, StoryObj } from "@storybook/react";
import {
  Skeleton,
  FlowLoader,
  MetricLoader,
  ChartLoader,
  WorkspaceLoader,
  GalleryLoader,
  MarketplaceLoader,
} from "@shina/flow-engine";

// Doc 14 — Loading System. Spinner tradicional é proibido em toda a Shinã.

const meta: Meta = {
  title: "AI Experience/Loading",
  parameters: {
    docs: {
      description: {
        component:
          "Skeleton (shimmer direcional) e Flow Loader (fluxo indeterminado) — nunca um círculo girando.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const SkeletonRows: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <Skeleton height={14} width="60%" />
      <div style={{ height: 8 }} />
      <Skeleton height={14} width="90%" />
      <div style={{ height: 8 }} />
      <Skeleton height={14} width="75%" />
    </div>
  ),
};

export const FlowLoaderBar: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <FlowLoader label="Gerando anúncio" />
    </div>
  ),
};

export const MetricLoaderCard: Story = {
  render: () => <MetricLoader />,
};

export const ChartLoaderBars: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <ChartLoader />
    </div>
  ),
};

export const WorkspaceLoaderLayout: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <WorkspaceLoader />
    </div>
  ),
};

export const GalleryLoaderGrid: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <GalleryLoader />
    </div>
  ),
};

export const MarketplaceLoaderCards: Story = {
  render: () => (
    <div style={{ width: 640 }}>
      <MarketplaceLoader />
    </div>
  ),
};
