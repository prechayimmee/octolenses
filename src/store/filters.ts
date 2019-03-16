import { defaults, findIndex } from 'lodash';
import { action, computed, observable } from 'mobx';
import { persist } from 'mobx-persist';
import { arrayMove } from 'react-sortable-hoc';
import uuidv1 from 'uuid/v1';

import { toast } from '../components/ToastManager';
import { StoredPredicate, ProviderType, providers } from '../providers';

type FilterIdentifier = string;

export class Filter {
  @persist
  public provider: ProviderType;

  @persist
  @observable
  public id: FilterIdentifier;

  @persist
  @observable
  public label = '';

  @persist('list')
  @observable
  public predicates: StoredPredicate[] = [];

  @observable
  public data: any[] = []; // TODO

  @observable
  public loading = false;

  public serializePredicate(payload: StoredPredicate): string {
    const provider = providers[this.provider];
    const predicate = provider.findPredicate(payload.type);
    return predicate.serialize(payload);
  }
}

class FiltersStore {
  @persist('list', Filter)
  @observable
  private data: Filter[] = [];

  @computed
  get firstFilterId(): FilterIdentifier {
    if (this.count === 0) {
      return null;
    }

    return this.data[0].id;
  }

  @computed
  get count() {
    return this.data.length;
  }

  @action.bound
  saveFilter(filter: Filter) {
    const filterWithDefaults = formatFilter(filter);

    const index = findIndex(this.data, { id: filterWithDefaults.id });
    if (index === -1) {
      this.data.push(filterWithDefaults);
    } else {
      this.data[index] = filterWithDefaults;
    }

    this.fetchFilter(filterWithDefaults);
  }

  @action.bound
  cloneFilter(id: FilterIdentifier) {
    const index = findIndex(this.data, { id });
    const filter = this.data[index];

    const clonedFilter = formatFilter({
      ...filter,
      label: `${filter.label} (Copy)`,
      id: undefined,
    });

    this.data.splice(index + 1, 0, clonedFilter);

    return clonedFilter;
  }

  @action.bound
  removeFilter(id: FilterIdentifier) {
    const index = findIndex(this.data, { id });
    this.data.splice(index, 1);
  }

  @action.bound
  swapFilters(oldIndex: number, newIndex: number) {
    this.data = arrayMove(this.data, oldIndex, newIndex);
  }

  @action.bound
  async fetchFilter(filter: Filter) {
    const index = findIndex(this.data, { id: filter.id });
    this.data[index].loading = true;

    try {
      const result = await providers[filter.provider].fetchFilter(filter);
      this.data[index].data = result;
    } catch (error) {
      // TODO Handle various errors (RateLimitError for now)
      toast('Oops, something failed with your filter!', 'error');
      console.log(error);
    }

    this.data[index].loading = false;
  }

  async fetchAllFilters() {
    await Promise.all(this.data.map(this.fetchFilter));
  }
}

function formatFilter(filter: Filter) {
  return defaults({}, filter, {
    data: [],
    loading: false,
    id: uuidv1(),
  });
}

// TODO Handle provider here...
export const EMPTY_FILTER_PAYLOAD = {
  label: 'Unnamed filter',
  predicates: [{ type: 'status', value: 'open' }],
};

export const filters = new FiltersStore();