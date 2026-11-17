import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, useSearchParams } from "react-router";
import { expect, it } from "vitest";
import { renderAt, Where } from "../test-kit";
import { SavedViews } from "./SavedViews";

function Page() {
  const [params, setParams] = useSearchParams();
  return (
    <>
      <SavedViews scope="test-requests" params={params} onApply={setParams} />
      <Where />
    </>
  );
}
it("restores saved filters after remount without restoring a selected row", async () => {
  localStorage.removeItem("code:test-requests:views");
  const first = renderAt(
    "/view?state=requested&q=DNA&id=r-1&offset=100",
    <Route path="/view" element={<Page />} />,
  );
  await userEvent.type(screen.getByLabelText("View name"), "DNA triage");
  await userEvent.click(screen.getByRole("button", { name: "Save view" }));
  first.unmount();
  renderAt("/view", <Route path="/view" element={<Page />} />);
  await userEvent.click(screen.getByRole("button", { name: "DNA triage" }));
  expect(screen.getByTestId("where")).toHaveTextContent("/view?state=requested&q=DNA");
  expect(screen.getByTestId("where")).not.toHaveTextContent("id=");
  localStorage.removeItem("code:test-requests:views");
});
