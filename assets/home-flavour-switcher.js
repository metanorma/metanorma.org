(function () {
  let el = React.createElement;

  class ModeSwitcher extends React.Component {
    /* Very simple generic switcher */

    constructor(props) {
      super();
      this.state = { selectedMode: undefined };
      this.selectMode = this.selectMode.bind(this);
    }
    render() {
      const buttons = this.props.modes.map((mode) => {
        return el('button', {
          key: mode.id,
          className: mode.id === this.state.selectedMode ? 'active' : 'inactive',
          onClick: () => { this.selectMode(mode.id) },
        }, mode.title);
      });

      return el(React.Fragment, null, buttons);
    }
    selectMode(modeId) {
      this.setState({ selectedMode: modeId });
      this.props.onModeSelect(modeId);
    }
  }

  class HomeFlavourSwitcher {
    constructor(containerEl, attributeName, defaultModeId) {
      this.attributeName = attributeName;
      this.switchables = containerEl.querySelectorAll(`[data-${attributeName}]`);

      const modes = Array.from(this.switchables, (el) => { return {
        id: el.dataset.mode,
        title: el.querySelector('h3').innerText,
      }; });

      this.selectMode = this.selectMode.bind(this);

      const switcherContainer = document.createElement('div');
      switcherContainer.classList.add('switcher');
      containerEl.appendChild(switcherContainer);

      let switcherRef = React.createRef();
      const switcher = el(ModeSwitcher, { modes, onModeSelect: this.selectMode, ref: switcherRef });

      ReactDOM.render(switcher, switcherContainer);
      switcherRef.current.selectMode(defaultModeId);

      containerEl.classList.add('with-switcher');
    }
    selectMode(modeId) {
      for (let el of this.switchables) {
        if (el.dataset[this.attributeName] === modeId) {
          el.removeAttribute('style');
        } else {
          el.style.display = 'none';
        }
      }
    }
  }

  const switchableFlavoursContainer = document.querySelector('section.switchable-flavours');
  const defaultMode = 'standards-bodies';
  const switcher = new HomeFlavourSwitcher(switchableFlavoursContainer, 'mode', defaultMode);

}());
