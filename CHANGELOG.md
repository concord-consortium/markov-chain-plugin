# Changelog

## Version 0.5.0 - July 14, 2025

- Probability slider thumbs can be shifted in all cases [#78](https://github.com/concord-consortium/markov-chain-plugin/pull/78)
- Fix: generated outputs not highlighting correctly [#79](https://github.com/concord-consortium/markov-chain-plugin/pull/79)

## Version 0.4.0 - October 7, 2024

- Toggle an item in the output list to highlight its nodes and edges [#65](https://github.com/concord-consortium/markov-chain-plugin/pull/65) [#70](https://github.com/concord-consortium/markov-chain-plugin/pull/70)
- Dropdown for the delimiter, with no limit on its length [#67](https://github.com/concord-consortium/markov-chain-plugin/pull/67) [#74](https://github.com/concord-consortium/markov-chain-plugin/pull/74)
- Transition probabilities in dataset mode [#68](https://github.com/concord-consortium/markov-chain-plugin/pull/68)
- Lightbox dialogs replace the browser confirm dialog [#69](https://github.com/concord-consortium/markov-chain-plugin/pull/69)
- Reset fixes: zoom is reset, the graph is hidden while it redraws, text input is cleared, moved nodes are handled [#66](https://github.com/concord-consortium/markov-chain-plugin/pull/66) [#73](https://github.com/concord-consortium/markov-chain-plugin/pull/73) [#75](https://github.com/concord-consortium/markov-chain-plugin/pull/75) [#76](https://github.com/concord-consortium/markov-chain-plugin/pull/76)
- Fix: edges are placed under nodes [#64](https://github.com/concord-consortium/markov-chain-plugin/pull/64)
- Fix: dataset views load their saved attribute [#71](https://github.com/concord-consortium/markov-chain-plugin/pull/71)
- Fix: auto-arranged node positions are saved, so chains generated from text reload correctly [#72](https://github.com/concord-consortium/markov-chain-plugin/pull/72)
- Fix: the release workflow copies to the right destination file [#63](https://github.com/concord-consortium/markov-chain-plugin/pull/63)

## Version 0.3.0 - April 10, 2024

- Text input for building a chain from text [#55](https://github.com/concord-consortium/markov-chain-plugin/pull/55)
- Zoom in and out, panning, zoom buttons, and fit/center view [#52](https://github.com/concord-consortium/markov-chain-plugin/pull/52) [#53](https://github.com/concord-consortium/markov-chain-plugin/pull/53) [#59](https://github.com/concord-consortium/markov-chain-plugin/pull/59)
- Reset and home buttons; reset returns to the loaded model and clears the sequence setup and output [#39](https://github.com/concord-consortium/markov-chain-plugin/pull/39) [#50](https://github.com/concord-consortium/markov-chain-plugin/pull/50) [#58](https://github.com/concord-consortium/markov-chain-plugin/pull/58)
- Click a state to highlight it [#33](https://github.com/concord-consortium/markov-chain-plugin/pull/33)
- Fast simulation mode, play during stepping, and a cancel button [#40](https://github.com/concord-consortium/markov-chain-plugin/pull/40) [#43](https://github.com/concord-consortium/markov-chain-plugin/pull/43) [#61](https://github.com/concord-consortium/markov-chain-plugin/pull/61)
- No sequence length limit, a new default delimiter, and "(space)" shown for a space delimiter [#36](https://github.com/concord-consortium/markov-chain-plugin/pull/36) [#48](https://github.com/concord-consortium/markov-chain-plugin/pull/48)
- UI updated to the design specs; tools can be toggled off [#38](https://github.com/concord-consortium/markov-chain-plugin/pull/38) [#42](https://github.com/concord-consortium/markov-chain-plugin/pull/42)
- Inputs are disabled while animating [#57](https://github.com/concord-consortium/markov-chain-plugin/pull/57)
- Fixes to pause and step, output labels, re-layouts on node moves, deleted cases, the sidebar, CODAP change listeners, the probability slider, and the viewport [#30](https://github.com/concord-consortium/markov-chain-plugin/pull/30) [#34](https://github.com/concord-consortium/markov-chain-plugin/pull/34) [#35](https://github.com/concord-consortium/markov-chain-plugin/pull/35) [#37](https://github.com/concord-consortium/markov-chain-plugin/pull/37) [#44](https://github.com/concord-consortium/markov-chain-plugin/pull/44) [#45](https://github.com/concord-consortium/markov-chain-plugin/pull/45) [#49](https://github.com/concord-consortium/markov-chain-plugin/pull/49) [#51](https://github.com/concord-consortium/markov-chain-plugin/pull/51) [#54](https://github.com/concord-consortium/markov-chain-plugin/pull/54) [#56](https://github.com/concord-consortium/markov-chain-plugin/pull/56) [#60](https://github.com/concord-consortium/markov-chain-plugin/pull/60)

## Version 0.2.0 - April 1, 2024

- Drawing mode, with press-and-drag node creation, mode-specific pointers, Escape to return to select mode, and feedback while creating and deleting edges and nodes [#14](https://github.com/concord-consortium/markov-chain-plugin/pull/14) [#17](https://github.com/concord-consortium/markov-chain-plugin/pull/17) [#18](https://github.com/concord-consortium/markov-chain-plugin/pull/18) [#19](https://github.com/concord-consortium/markov-chain-plugin/pull/19) [#21](https://github.com/concord-consortium/markov-chain-plugin/pull/21) [#23](https://github.com/concord-consortium/markov-chain-plugin/pull/23) [#25](https://github.com/concord-consortium/markov-chain-plugin/pull/25) [#26](https://github.com/concord-consortium/markov-chain-plugin/pull/26) [#27](https://github.com/concord-consortium/markov-chain-plugin/pull/27)
- Probability selector component [#20](https://github.com/concord-consortium/markov-chain-plugin/pull/20)
- The selected attribute is saved in the CODAP document [#6](https://github.com/concord-consortium/markov-chain-plugin/pull/6)
- Updated graph styling and a new two-step animation sequence [#7](https://github.com/concord-consortium/markov-chain-plugin/pull/7) [#8](https://github.com/concord-consortium/markov-chain-plugin/pull/8) [#9](https://github.com/concord-consortium/markov-chain-plugin/pull/9)
- The main menu is hidden while loading [#22](https://github.com/concord-consortium/markov-chain-plugin/pull/22)
- Misc UI fixes and bug fixes [#12](https://github.com/concord-consortium/markov-chain-plugin/pull/12) [#13](https://github.com/concord-consortium/markov-chain-plugin/pull/13) [#16](https://github.com/concord-consortium/markov-chain-plugin/pull/16) [#24](https://github.com/concord-consortium/markov-chain-plugin/pull/24)

## Version 0.1.0 - March 21, 2023

- Initial release: React and D3 node layout, a starting state for generation, generator settings in the text output, the start of the graph animation, and edges drawn under nodes [#1](https://github.com/concord-consortium/markov-chain-plugin/pull/1) [#2](https://github.com/concord-consortium/markov-chain-plugin/pull/2) [#3](https://github.com/concord-consortium/markov-chain-plugin/pull/3) [#4](https://github.com/concord-consortium/markov-chain-plugin/pull/4) [#5](https://github.com/concord-consortium/markov-chain-plugin/pull/5)
