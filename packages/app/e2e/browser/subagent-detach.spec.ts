import { expect, test } from "../support/fixtures";
import { expectWorkspaceTabVisible } from "../support/helpers/archive-tab";
import { expectAgentTabActive } from "../support/helpers/launcher";
import { openAgentRoute } from "../support/helpers/mock-agent";
import { seedWorkspace, type SeededWorkspace } from "../support/helpers/seed-client";
import {
  detachSubagentFromTrack,
  holdManagedSubagentArchiveRequest,
  expectManagedSubagentArchived,
  expectSubagentRowGone,
  expectSubagentRowVisible,
  openSubagentsTrack,
  seedParentWithSubagent,
} from "../support/helpers/subagents";

function actionsAreCentered(element: HTMLElement | SVGElement, id: string): boolean {
  const action = document.querySelector(`[data-testid="subagents-track-archive-${id}"]`)!;
  const actionRect = action.getBoundingClientRect();
  const rowRect = element.getBoundingClientRect();
  return Math.abs(actionRect.y + actionRect.height / 2 - rowRect.y - rowRect.height / 2) < 1;
}

test.describe("Subagent detach", () => {
  let workspace: SeededWorkspace;

  test.beforeAll(async () => {
    workspace = await seedWorkspace({ repoPrefix: "subagent-detach-" });
  });

  test.afterAll(async () => {
    await workspace?.cleanup();
  });

  for (const width of [1280, 390]) {
    test(`row disclosure and archive stay separate at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const agents = await seedParentWithSubagent(workspace, {
        parentTitle: `Action parent ${width}`,
        childTitle: `Action child ${width}`,
      });
      const gate = await holdManagedSubagentArchiveRequest(page, agents.child.id);
      try {
        await openAgentRoute(page, { workspaceId: agents.workspaceId, agentId: agents.parent.id });
        await page.getByTestId("subagents-track-header").click();
        await expectSubagentRowVisible(page, agents.child.id);
        const parentRoute = page.url();
        const row = page.getByTestId(`subagents-track-row-${agents.child.id}`);
        const archive = page.getByTestId(`subagents-track-archive-${agents.child.id}`);
        const details = page.getByTestId(`subagents-track-expanded-${agents.child.id}`);
        await row.hover();
        const before = await row.boundingBox();
        await archive.hover();
        await expect(archive).toBeVisible();
        expect(await row.boundingBox()).toEqual(before);
        const labelBox = await page
          .getByTestId(`subagents-track-label-${agents.child.id}`)
          .boundingBox();
        const archiveBox = await archive.boundingBox();
        expect(labelBox).not.toBeNull();
        expect(archiveBox).not.toBeNull();
        expect(labelBox!.x + labelBox!.width).toBeLessThan(archiveBox!.x);
        expect(archiveBox!.height).toBe(width === 390 ? 32 : 20);
        await row.click();
        await expect(row).toHaveAttribute("aria-expanded", "true");
        await expect(details).toBeVisible();
        const task = page.getByTestId(`subagents-track-original-task-toggle-${agents.child.id}`);
        await task.click();
        await expect(task).toHaveAttribute("aria-expanded", "true");
        await expect(
          page.getByTestId(`subagents-track-original-task-${agents.child.id}`),
        ).toHaveText(agents.child.title);
        await expect(row).toBeVisible();
        // Expanded content must not move the header's sibling action cluster down into details.
        await expect.poll(() => row.evaluate(actionsAreCentered, agents.child.id)).toBe(true);
        await row.click();
        await expect(details).toHaveCount(0);
        await row.hover();
        page.once("dialog", (dialog) => {
          expect(dialog.message()).toContain("Archive subagent?");
          void dialog.accept();
        });
        await archive.click();
        await gate.waitForRequest();
        await expect(details).toHaveCount(0);
        // Archive optimistically removes its row, even while the daemon request is held.
        // It must not navigate into the child or expose its inline details.
        await expect(page).toHaveURL(parentRoute);
        await expect(page.getByTestId(`workspace-tab-agent_${agents.child.id}`)).toHaveCount(0);
        await expect(
          page.getByRole("dialog", { name: agents.child.title, exact: true }),
        ).toHaveCount(0);
        gate.release();
        await expectManagedSubagentArchived(workspace, agents.child.id);
        await expectSubagentRowGone(page, agents.child.id);
      } finally {
        gate.release();
      }
    });
  }

  test("detaching a subagent focuses it as a workspace tab", async ({ page }) => {
    const agents = await seedParentWithSubagent(workspace, {
      parentTitle: "Detach parent",
      childTitle: "Detached child",
    });

    await openAgentRoute(page, {
      workspaceId: agents.workspaceId,
      agentId: agents.parent.id,
    });
    await openSubagentsTrack(page);
    await expectSubagentRowVisible(page, agents.child.id);

    await detachSubagentFromTrack(page, agents.child.id);

    await expectSubagentRowGone(page, agents.child.id);
    await expectWorkspaceTabVisible(page, agents.child.id);
    await expectAgentTabActive(page, agents.child.id);
  });
});
