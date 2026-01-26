/ide to see changes

Have cluade run through doc editing senerios:
- fix "remove all empty lines"
- Convervt all "-" to lists


Merge:
git checkout main
git pull origin main
git merge [Branchname]
git push origin main

Delete Branches:
git branch --merged main | grep -v "main" | xargs git branch -d

const root = Documents.squireEditor.getRoot();
  Array.from(root.children).forEach((el, i) => {
    const empty = el.textContent.trim() === '' ? '🔴' : '✅';
    console.log(`${i}: ${empty} [${el.dataset.editId?.slice(0,8) || 'NO-ID'}] ${el.outerHTML}`);
  });